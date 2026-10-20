"""
Benchmark de modelos e hiperparámetros Ollama para el chatbot RRHH (RAG).
Mide latencia y guarda resultados en CSV para elegir la mejor configuración.
"""

import time
import csv
from pathlib import Path
from datetime import datetime

from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# ======================
# CONFIGURACIÓN
# ======================
BASE_DIR = Path(__file__).parent
INDEX_DIR = BASE_DIR / "data" / "faiss_index"
RESULTADOS_DIR = BASE_DIR / "resultados"
RESULTADOS_DIR.mkdir(parents=True, exist_ok=True)

EMBEDDING_MODEL = "nomic-embed-text"

# Modelos a probar (asegúrate de haber hecho: ollama pull <modelo>)
MODELOS = [
    "llama3.2:3b",
    "qwen2.5:3b",
    "qwen2.5:1.5b",
    # "qwen2.5:7b",  # opcional, más lento
]

TEMPERATURES = [0.0, 0.1, 0.3]
KS = [1, 2, 3]
NUM_PREDICT = 256

# Preguntas fijas de prueba (ajústalas a tus PDFs)
PREGUNTAS = [
    "¿Cuántos días de vacaciones me corresponden al año?",
    "¿Cómo solicito un permiso de ausencia?",
    "¿Cuál es el horario laboral de la empresa?",
    "¿Qué documentos necesito para solicitar vacaciones?",
    "¿A quién debo contactar si tengo dudas de nómina?",
]

# Repeticiones por combinación (la 1ª puede ser más lenta por cold start)
REPETICIONES = 2


# ======================
# RAG
# ======================
def cargar_vectorstore():
    if not INDEX_DIR.exists() or not any(INDEX_DIR.iterdir()):
        raise FileNotFoundError(
            f"No hay índice FAISS en {INDEX_DIR}. "
            "Sube PDFs y ejecuta /reindex en la API antes del benchmark."
        )
    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
    return FAISS.load_local(
        str(INDEX_DIR),
        embeddings,
        allow_dangerous_deserialization=True,
    )


def construir_cadena_rag(vectorstore, modelo: str, temperature: float, k: int, num_predict: int):
    llm = ChatOllama(
        model=modelo,
        temperature=temperature,
        num_predict=num_predict,
    )
    retriever = vectorstore.as_retriever(search_kwargs={"k": k})

    template = """Eres un asistente experto de Recursos Humanos.
Responde ÚNICAMENTE basándote en el siguiente contexto extraído de los documentos de la empresa.
Si la información no está en el contexto, di claramente que no tienes esa información en los documentos disponibles.
Sé claro, profesional y conciso. Cuando sea posible, menciona de qué documento proviene la información.

CONTEXTO:
{context}

PREGUNTA DEL EMPLEADO:
{question}

RESPUESTA:"""

    prompt = ChatPromptTemplate.from_template(template)

    def formatear_docs(docs):
        return "\n\n".join(
            f"[Fuente: {d.metadata.get('source', 'desconocido')} | Página: {d.metadata.get('page', '?')}]\n{d.page_content}"
            for d in docs
        )

    cadena = (
        {"context": retriever | formatear_docs, "question": RunnablePassthrough()}
        | prompt
        | llm
        | StrOutputParser()
    )
    return cadena


# ======================
# BENCHMARK
# ======================
def main():
    print("=" * 60)
    print("BENCHMARK OLLAMA - Chatbot RRHH")
    print("=" * 60)

    vectorstore = cargar_vectorstore()
    print(f"Índice FAISS cargado desde: {INDEX_DIR}\n")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_path = RESULTADOS_DIR / f"benchmark_{timestamp}.csv"

    campos = [
        "modelo",
        "temperature",
        "k",
        "num_predict",
        "pregunta",
        "repeticion",
        "latencia_seg",
        "respuesta",
        "error",
    ]

    total_combos = len(MODELOS) * len(TEMPERATURES) * len(KS)
    combo_actual = 0

    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=campos)
        writer.writeheader()

        for modelo in MODELOS:
            for temperature in TEMPERATURES:
                for k in KS:
                    combo_actual += 1
                    print(f"\n[{combo_actual}/{total_combos}] modelo={modelo} | temp={temperature} | k={k}")

                    try:
                        cadena = construir_cadena_rag(
                            vectorstore,
                            modelo=modelo,
                            temperature=temperature,
                            k=k,
                            num_predict=NUM_PREDICT,
                        )
                    except Exception as e:
                        print(f"  ERROR creando cadena: {e}")
                        for pregunta in PREGUNTAS:
                            writer.writerow({
                                "modelo": modelo,
                                "temperature": temperature,
                                "k": k,
                                "num_predict": NUM_PREDICT,
                                "pregunta": pregunta,
                                "repeticion": 0,
                                "latencia_seg": "",
                                "respuesta": "",
                                "error": str(e),
                            })
                        continue

                    for pregunta in PREGUNTAS:
                        for rep in range(1, REPETICIONES + 1):
                            t0 = time.perf_counter()
                            error = ""
                            respuesta = ""
                            try:
                                respuesta = cadena.invoke(pregunta)
                            except Exception as e:
                                error = str(e)
                                print(f"  ERROR en pregunta: {e}")
                            latencia = round(time.perf_counter() - t0, 3)

                            writer.writerow({
                                "modelo": modelo,
                                "temperature": temperature,
                                "k": k,
                                "num_predict": NUM_PREDICT,
                                "pregunta": pregunta,
                                "repeticion": rep,
                                "latencia_seg": latencia if not error else "",
                                "respuesta": respuesta[:500] if respuesta else "",  # recorta para el CSV
                                "error": error,
                            })
                            f.flush()

                            estado = f"{latencia}s" if not error else "ERROR"
                            print(f"  rep={rep} | {estado} | {pregunta[:50]}...")

    print("\n" + "=" * 60)
    print(f"Benchmark terminado.")
    print(f"Resultados guardados en: {csv_path}")
    print("=" * 60)
    print("\nSiguiente paso:")
    print("1. Abre el CSV y calcula latencia media por (modelo, temperature, k)")
    print("2. Revisa la calidad de las respuestas")
    print("3. Elige la mejor combinación y actualízala en api.py")


if __name__ == "__main__":
    main()
