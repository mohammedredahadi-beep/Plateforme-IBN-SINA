import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import FAISS
from langchain.text_splitter import CharacterTextSplitter
from langchain_community.document_loaders import TextLoader
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate

# Configuration
GOOGLE_API_KEY = "AIzaSyA90rpD5deCJip4V1AXQ3_Yl4Y1qSS-Km0"
os.environ["GOOGLE_API_KEY"] = GOOGLE_API_KEY

class IbnSinaChatbot:
    def __init__(self):
        print("Initializing Chatbot...")
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", google_api_key=GOOGLE_API_KEY)
        self.vector_store = None
        self.qa_chain = None
        self._build_rag_pipeline()

    def _build_rag_pipeline(self):
        try:
            # 1. Load Knowledge Base
            loader = TextLoader("knowledge_base.txt", encoding='utf-8')
            documents = loader.load()

            # 2. Split Text
            text_splitter = CharacterTextSplitter(chunk_size=500, chunk_overlap=50)
            texts = text_splitter.split_documents(documents)

            # 3. Create Embeddings & Vector Store
            # Note: Using Gemini embeddings requires the same API key
            embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
            self.vector_store = FAISS.from_documents(texts, embeddings)

            # 4. Create Retrieval Chain
            retriever = self.vector_store.as_retriever(search_kwargs={"k": 3})
            
            prompt_template = """Tu es l'assistant IA de la plateforme Ibn Sina.
Utilise les informations suivantes pour répondre à la question de l'utilisateur.
Si tu ne connais pas la réponse, dis simplement que tu ne sais pas, n'invente rien.
Sois courtois, concis et utile.

Contexte:
{context}

Question: {question}
Réponse:"""
            
            PROMPT = PromptTemplate(
                template=prompt_template, input_variables=["context", "question"]
            )

            self.qa_chain = RetrievalQA.from_chain_type(
                llm=self.llm,
                chain_type="stuff",
                retriever=retriever,
                chain_type_kwargs={"prompt": PROMPT}
            )
            print("RAG Pipeline built successfully.")

        except Exception as e:
            print(f"Error building RAG pipeline: {e}")
            # Fallback to simple LLM if RAG fails (e.g., file not found)
            self.qa_chain = None

    def get_response(self, query):
        if self.qa_chain:
            try:
                # Use RAG
                return self.qa_chain.run(query)
            except Exception as e:
                print(f"RAG Error: {e}")
                # Fallback
                return self.llm.invoke(query).content
        else:
            # Simple LLM fallback
            return self.llm.invoke(query).content

# Test instance
if __name__ == "__main__":
    bot = IbnSinaChatbot()
    print(bot.get_response("Comment je peux devenir mentor ?"))
