from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pathlib import Path
import shutil
from typing import List

from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_ollama import OllamaEmbeddings, ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser

# ======================
# CONFIGURACIÓN
# ======================
BASE_DIR = Path(__file__).parent
DOCS_DIR = BASE_DIR / "data" / "documentos"
INDEX_DIR = BASE_DIR / "data" / "faiss_index"

DOCS_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)

EMBEDDING_MODEL = "nomic-embed-text"
LLM_MODEL = "qwen2.5:7b"

app = FastAPI(title="Chatbot RRHH API", version="1.0")

# Permitir llamadas desde el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # en producción pon solo http://localhost:5173
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    question: str

class ChatResponse(BaseModel):
    answer: str

# ======================
# FUNCIONES RAG
# ======================
def cargar_documentos_pdf():
    documentos = []
    for archivo in DOCS_DIR.glob("*.pdf"):
        try:
            loader = PyPDFLoader(str(archivo))
            docs = loader.load()
            for doc in docs:
                doc.metadata["source"] = archivo.name
            documentos.extend(docs)
        except Exception as e:
            print(f"Error cargando {archivo.name}: {e}")
    return documentos

def crear_o_actualizar_indice():
    documentos = cargar_documentos_pdf()
    if not documentos:
        return False, "No se encontraron PDFs para procesar."

    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len,
    )
    chunks = text_splitter.split_documents(documentos)

    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)

    if INDEX_DIR.exists():
        shutil.rmtree(INDEX_DIR)
    INDEX_DIR.mkdir(parents=True, exist_ok=True)

    vectorstore = FAISS.from_documents(chunks, embeddings)
    vectorstore.save_local(str(INDEX_DIR))

    return True, f"Índice creado con {len(chunks)} fragmentos."

def cargar_vectorstore():
    if not INDEX_DIR.exists() or not any(INDEX_DIR.iterdir()):
        return None
    embeddings = OllamaEmbeddings(model=EMBEDDING_MODEL)
    return FAISS.load_local(
        str(INDEX_DIR),
        embeddings,
        allow_dangerous_deserialization=True
    )

def construir_cadena_rag(vectorstore):
    llm = ChatOllama(model=LLM_MODEL, temperature=0.1)
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
# ENDPOINTS
# ======================
@app.get("/")
def root():
    return {"status": "ok", "service": "Chatbot RRHH API"}

@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    vectorstore = cargar_vectorstore()
    if vectorstore is None:
        raise HTTPException(
            status_code=400,
            detail="No hay base de conocimiento. Un administrador debe subir documentos y actualizar el índice."
        )
    try:
        cadena = construir_cadena_rag(vectorstore)
        respuesta = cadena.invoke(req.question)
        return ChatResponse(answer=respuesta)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload(files: List[UploadFile] = File(...)):
    guardados = []
    for file in files:
        if not file.filename.lower().endswith(".pdf"):
            continue
        ruta = DOCS_DIR / file.filename
        with open(ruta, "wb") as f:
            content = await file.read()
            f.write(content)
        guardados.append(file.filename)
    return {"ok": True, "files": guardados, "message": f"{len(guardados)} archivo(s) subido(s)."}

@app.post("/reindex")
def reindex():
    exito, mensaje = crear_o_actualizar_indice()
    if not exito:
        raise HTTPException(status_code=400, detail=mensaje)
    return {"ok": True, "message": mensaje}

@app.get("/docs")
def list_docs():
    docs = [f.name for f in DOCS_DIR.glob("*.pdf")]
    return {"documents": docs}
