# AI Chatbot

A full-stack AI chatbot application built with Django REST Framework and React. It uses the Google Gemini API to stream responses in real time using Server-Sent Events (SSE) and persists conversation history in SQLite.

## Features

- Real-time streaming responses via Server-Sent Events (SSE)
- Multi-turn conversation memory using previous chat messages
- Full conversation management (create new chat, view history, clear messages, delete chat)
- Stop generation support to abort in-flight responses
- Clean Dark and Light mode interface
- Secure backend API handling (API keys are never exposed to the client)

## Tech Stack

- **Backend:** Python, Django, Django REST Framework, SQLite
- **AI SDK:** `google-genai` (Google Gemini API)
- **Frontend:** React, Vite, Vanilla CSS
- **Streaming:** Server-Sent Events (SSE)

## Project Structure

```text
AI Chatboat/
├── backend/
│   ├── chatbot/
│   │   ├── migrations/
│   │   │   ├── 0001_initial.py
│   │   │   └── __init__.py
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   └── ai_service.py
│   │   ├── __init__.py
│   │   ├── admin.py
│   │   ├── apps.py
│   │   ├── exceptions.py
│   │   ├── models.py
│   │   ├── serializers.py
│   │   ├── test_ai_service.py
│   │   ├── test_chat.py
│   │   ├── tests.py
│   │   ├── urls.py
│   │   └── views.py
│   ├── config/
│   │   ├── __init__.py
│   │   ├── asgi.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   └── wsgi.py
│   ├── .env.example
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   └── vite.svg
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatArea.jsx
│   │   │   │   ├── ChatHeader.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   ├── MessageInput.jsx
│   │   │   │   ├── MessageItem.jsx
│   │   │   │   └── TypingIndicator.jsx
│   │   │   ├── common/
│   │   │   │   ├── LanguageSelector.jsx
│   │   │   │   └── ThemeToggle.jsx
│   │   │   ├── sidebar/
│   │   │   │   ├── ConversationItem.jsx
│   │   │   │   ├── ConversationList.jsx
│   │   │   │   ├── ConversationMenu.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   ├── ConnectionStatus.jsx
│   │   │   ├── Header.jsx
│   │   │   └── ScaffoldCard.jsx
│   │   ├── mock/
│   │   │   └── mockData.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+

### 1. Backend Setup

```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
python manage.py migrate
```

### 2. Frontend Setup

```bash
cd frontend
npm install
```

## Environment Variables

### Backend (`backend/.env`)
Copy `backend/.env.example` to `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

Set the required values in `backend/.env`:

```env
SECRET_KEY=your_secret_key_here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173

AI_PROVIDER=gemini
AI_API_KEY=your_gemini_api_key_here
AI_MODEL=gemini-3.6-flash
AI_CONTEXT_MESSAGE_LIMIT=20
AI_TIMEOUT_SECONDS=60
```

> **Note:** Keep your `AI_API_KEY` private and never commit it to source control.

### Frontend (`frontend/.env`)
Copy `frontend/.env.example` to `frontend/.env`:

```bash
cp frontend/.env.example frontend/.env
```

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api
```

## Run the Project

### Start the Backend
From the `backend/` directory:

```bash
python manage.py runserver 127.0.0.1:8000
```

### Start the Frontend
From the `frontend/` directory:

```bash
npm run dev
```

Open `http://127.0.0.1:5173` in your browser.

## API Endpoints

- `GET /api/conversations/` - List all conversations
- `POST /api/conversations/` - Create a new conversation
- `GET /api/conversations/<id>/` - Get message history for a conversation
- `DELETE /api/conversations/<id>/` - Delete a conversation and its messages
- `DELETE /api/conversations/<id>/clear/` - Clear all messages in a conversation
- `POST /api/chat/` - Send a message and stream the response via SSE

## Notes

- **Google Gemini API:** The backend uses the official `google-genai` Python SDK to interact with Gemini models.
- **SSE Streaming:** `POST /api/chat/` streams responses using Django's `StreamingHttpResponse` with `meta`, `token`, and `done` events.
- **SQLite Storage:** Conversations and messages are stored in SQLite with foreign keys, enabling persistent chat history.
- **Conversation Memory:** Before generating a reply, recent conversation messages are loaded from SQLite and mapped to Gemini roles (`user` and `model`) up to the configured limit.
