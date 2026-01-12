from flask import Flask, request, jsonify
from flask_cors import CORS
from chatbot import IbnSinaChatbot

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Initialize Chatbot
try:
    bot = IbnSinaChatbot()
except Exception as e:
    print(f"Failed to initialize chatbot: {e}")
    bot = None

@app.route('/chat', methods=['POST'])
def chat():
    if not bot:
        return jsonify({"response": "Le service IA est temporairement indisponible (Erreur RAG)."}), 500

    data = request.json
    user_message = data.get('message', '')

    if not user_message:
        return jsonify({"error": "Message empty"}), 400

    try:
        # Get response from RAG Chatbot
        ai_response = bot.get_response(user_message)
        return jsonify({"response": ai_response})
    except Exception as e:
        print(f"Error processing request: {e}")
        return jsonify({"response": "Désolé, une erreur est survenue lors du traitement de votre demande."}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "rag_active": bot.qa_chain is not None})

if __name__ == '__main__':
    print("Starting Flask Server on port 5000...")
    app.run(debug=True, port=5000)
