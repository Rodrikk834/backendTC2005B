import streamlit as st
import os
import shutil
from pathlib import Path

# LangChain
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser


BASE_DATA_DIR = Path("data")
BASE_DATA_DIR.mkdir(exist_ok=True)

EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "qwen2.5:7b"          # alternativas: "llama3.2:3b", "gemma2:9b"



def listar_empresas():
    """Devuelve la lista de empresas (carpetas dentro de /data)"""
    if not BASE_DATA_DIR.exists():
        return []
    return sorted([d.name for d in BASE_DATA_DIR.iterdir() if d.is_dir()])

def crear_empresa(nombre: str):
    """Crea la estructura de carpetas de una nueva empresa"""
    empresa_dir = BASE_DATA_DIR / nombre
    (empresa_dir / "documentos").mkdir(parents=True, exist_ok=True)
    (empresa_dir / "faiss_index").mkdir(parents=True, exist_ok=True)
    return empresa_dir

def obtener_ruta_documentos(empresa: str) -> Path:
    return BASE_DATA_DIR / empresa / "documentos"

def obtener_ruta_faiss(empresa: str) -> Path:
    return BASE_DATA_DIR / empresa / "faiss_index"

def cargar_documentos_pdf(carpeta_docs: Path):
    """Carga todos los PDFs de una carpeta"""
    documentos = []
    for archivo in carpeta_docs.glob("*.pdf"):
        try:
            loader = PyPDFLoader(str(archivo))
            docs = loader.load()
            for doc in docs:
                doc.metadata["source"] = archivo.name
            documentos.extend(docs)
        except Exception as e:
            st.warning(f"No se pudo cargar {archivo.name}: {e}")
    return documentos

def crear_o_actualizar_indice(empresa: str):
    """Procesa los PDFs de la empresa y crea/actualiza el índice FAISS"""
    docs_dir = obtener_ruta_documentos(empresa)
    faiss_dir = obtener_ruta_faiss(empresa)

    documentos = cargar_documentos_pdf(docs_dir)
    if not documentos:
        return False, "No se encontraron PDFs para procesar."

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_documents(documentos)

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)

    vectorstore = FAISS.from_documents(chunks, embeddings)
    
    vectorstore.save_local(str(faiss_dir))

    return True, f"Índice creado con {len(chunks)} fragmentos a partir de {len(documentos)} páginas."

def cargar_vectorstore(empresa: str):
    """Carga el índice FAISS de una empresa (si existe)"""
    faiss_dir = obtener_ruta_faiss(empresa)
    if not faiss_dir.exists() or not any(faiss_dir.iterdir()):
        return None

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
    vectorstore = FAISS.load_local(
        str(faiss_dir),
        embeddings,
        allow_dangerous_deserialization=True
    )
    return vectorstore

def construir_cadena_rag(vectorstore):
    """Construye la cadena RAG con el LLM local"""
    llm = ChatOllama(
        model=LLM_MODEL,
        temperature=0.1,
    )

    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})

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
# INTERFAZ STREAMLIT
# ======================

st.set_page_config(
    page_title="Chatbot RRHH Multi-Empresa (Local)",
    page_icon="🤖",
    layout="wide"
)

st.title("🤖 Chatbot de Recursos Humanos - Multi Empresa (Local)")

# ---------- Sidebar ----------
with st.sidebar:
    st.header("Configuración")

    empresas = listar_empresas()

    st.subheader("Seleccionar empresa")
    empresa_seleccionada = st.selectbox(
        "Empresa activa",
        options=empresas if empresas else ["(ninguna)"],
        index=0
    )

    st.divider()

    st.subheader("Crear nueva empresa")
    nueva_empresa = st.text_input("Nombre de la nueva empresa")
    if st.button("Crear empresa"):
        if nueva_empresa.strip():
            nombre_limpio = nueva_empresa.strip().lower().replace(" ", "_")
            crear_empresa(nombre_limpio)
            st.success(f"Empresa '{nombre_limpio}' creada.")
            st.rerun()
        else:
            st.error("Escribe un nombre válido.")

    st.divider()

    if empresa_seleccionada and empresa_seleccionada != "(ninguna)":
        st.subheader(f"Documentos de: {empresa_seleccionada}")

        # Subir PDFs
        archivos = st.file_uploader(
            "Subir PDFs",
            type=["pdf"],
            accept_multiple_files=True
        )

        if archivos:
            docs_dir = obtener_ruta_documentos(empresa_seleccionada)
            for archivo in archivos:
                ruta = docs_dir / archivo.name
                with open(ruta, "wb") as f:
                    f.write(archivo.getbuffer())
            st.success(f"{len(archivos)} archivo(s) guardado(s).")

        # Mostrar PDFs actuales
        docs_actuales = list(obtener_ruta_documentos(empresa_seleccionada).glob("*.pdf"))
        if docs_actuales:
            st.write("**PDFs cargados:**")
            for doc in docs_actuales:
                st.write(f"- {doc.name}")
        else:
            st.info("Aún no hay PDFs.")

        st.divider()

        if st.button("🔄 Procesar / Actualizar base de conocimiento", type="primary"):
            with st.spinner("Procesando documentos y creando índice..."):
                exito, mensaje = crear_o_actualizar_indice(empresa_seleccionada)
                if exito:
                    st.success(mensaje)
                else:
                    st.error(mensaje)

# ---------- Zona principal (Chat) ----------
if not empresa_seleccionada or empresa_seleccionada == "(ninguna)":
    st.info("👈 Crea o selecciona una empresa en la barra lateral para empezar.")
else:
    st.subheader(f"Chat — Empresa: **{empresa_seleccionada}**")

    vectorstore = cargar_vectorstore(empresa_seleccionada)

    if vectorstore is None:
        st.warning("Esta empresa todavía no tiene base de conocimiento. Sube PDFs y pulsa **Procesar**.")
    else:
        if "messages" not in st.session_state:
            st.session_state.messages = []

        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])

        if pregunta := st.chat_input("Escribe tu pregunta de RRHH..."):
            st.session_state.messages.append({"role": "user", "content": pregunta})
            with st.chat_message("user"):
                st.markdown(pregunta)

            with st.chat_message("assistant"):
                with st.spinner("Buscando en los documentos..."):
                    try:
                        cadena = construir_cadena_rag(vectorstore)
                        respuesta = cadena.invoke(pregunta)
                        st.markdown(respuesta)
                        st.session_state.messages.append({"role": "assistant", "content": respuesta})
                    except Exception as e:
                        st.error(f"Error al generar respuesta: {e}")

        if st.button("🗑️ Limpiar conversación"):
            st.session_state.messages = []
            st.rerun()