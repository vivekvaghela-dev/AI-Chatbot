import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/sidebar/Sidebar';
import ChatArea from './components/chat/ChatArea';
import {
  getConversations,
  getConversation,
  deleteConversation,
  clearConversation,
  streamChat,
} from './services/api';

function isTemporaryId(id) {
  if (!id) return true;
  if (id === 'temp-new-chat') return true;
  if (typeof id === 'string' && id.startsWith('temp-')) return true;
  return false;
}

export default function App() {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingAssistantText, setStreamingAssistantText] = useState('');
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  // Theme foundation (persisted in localStorage)
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('chatbot-theme') || 'dark';
  });

  // Language foundation (persisted in localStorage)
  const [language, setLanguage] = useState(() => {
    const saved = localStorage.getItem('chatbot-lang');
    return ['auto', 'en', 'hi', 'gu'].includes(saved) ? saved : 'auto';
  });

  const abortControllerRef = useRef(null);
  const isSendingRef = useRef(false);

  // Sync theme with HTML data-theme attribute
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('chatbot-theme', theme);
  }, [theme]);

  // Sync language with localStorage
  useEffect(() => {
    localStorage.setItem('chatbot-lang', language);
  }, [language]);

  // Cleanup active AbortController on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 1. Fetch real conversations from Django API (callable on mount & retry)
  const loadInitialConversations = async () => {
    setIsLoadingConversations(true);
    setErrorMessage(null);
    try {
      const list = await getConversations();

      if (Array.isArray(list) && list.length > 0) {
        setConversations(list);
        setActiveConversationId(list[0].id);
      } else {
        // No existing conversations in database: initialize a temporary unsaved chat
        const tempConv = {
          id: 'temp-new-chat',
          title: 'New Chat',
          isTemporary: true,
          updated_at: null,
        };
        setConversations([tempConv]);
        setActiveConversationId(tempConv.id);
        setMessages([]);
      }
    } catch (err) {
      setErrorMessage(
        err.message ||
          'Unable to connect to Django backend. Ensure server is running at http://127.0.0.1:8000.'
      );
    } finally {
      setIsLoadingConversations(false);
    }
  };

  useEffect(() => {
    loadInitialConversations();
  }, []);

  // 2. When activeConversationId changes: load real messages from Django API
  useEffect(() => {
    if (!activeConversationId || isTemporaryId(activeConversationId)) {
      setMessages([]);
      setIsLoadingMessages(false);
      return;
    }

    // If active generation is currently streaming (e.g. first message just promoted temp chat),
    // do not re-fetch from backend as messages are already actively in state
    if (isGenerating) {
      return;
    }

    let isMounted = true;

    async function loadMessages() {
      setIsLoadingMessages(true);
      try {
        const data = await getConversation(activeConversationId);
        if (!isMounted) return;
        setMessages(data.messages || []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMessage(err.message || 'Failed to load conversation history.');
      } finally {
        if (isMounted) setIsLoadingMessages(false);
      }
    }

    loadMessages();

    return () => {
      isMounted = false;
    };
  }, [activeConversationId]);

  const activeConversation = conversations.find(
    (c) => c.id === activeConversationId
  ) || null;

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleSelectLanguage = (newLang) => {
    setLanguage(newLang);
  };

  // 3. New Chat: create or switch to temporary conversation without backend call
  const handleNewChat = () => {
    if (isGenerating) return;
    setErrorMessage(null);

    // If already on an unsaved temporary conversation with no messages, keep it
    if (isTemporaryId(activeConversationId) && messages.length === 0) {
      return;
    }

    const tempConv = {
      id: 'temp-new-chat',
      title: 'New Chat',
      isTemporary: true,
      updated_at: null,
    };

    setConversations((prev) => [
      tempConv,
      ...prev.filter((c) => !isTemporaryId(c.id)),
    ]);
    setActiveConversationId(tempConv.id);
    setMessages([]);
    setInput('');
  };

  // 4. Selecting conversation: switch active id
  const handleSelectConversation = (id) => {
    if (id === activeConversationId) return;

    if (isGenerating && abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsGenerating(false);
      setStreamingAssistantText('');
    }

    setErrorMessage(null);

    // Clean up unsaved temporary conversation when switching to a persisted conversation
    setConversations((prev) =>
      prev.filter((c) => !isTemporaryId(c.id) || c.id === id)
    );
    setActiveConversationId(id);
  };

  // 5. Delete conversation: call DELETE /api/conversations/<id>/
  const handleDeleteConversation = async (id) => {
    try {
      if (!isTemporaryId(id)) {
        await deleteConversation(id);
      }
      setConversations((prev) => {
        const filtered = prev.filter((c) => c.id !== id);
        if (activeConversationId === id) {
          if (filtered.length > 0) {
            setActiveConversationId(filtered[0].id);
          } else {
            // If all conversations deleted, show a clean temporary new chat without backend call
            const tempConv = {
              id: 'temp-new-chat',
              title: 'New Chat',
              isTemporary: true,
              updated_at: null,
            };
            setActiveConversationId(tempConv.id);
            setMessages([]);
            return [tempConv];
          }
        }
        return filtered;
      });
    } catch (err) {
      setErrorMessage(err.message || 'Failed to delete conversation.');
    }
  };

  // 6. Clear chat: call DELETE /api/conversations/<id>/clear/
  const handleClearChat = async (targetId) => {
    const idToClear = targetId || activeConversationId;
    if (!idToClear || isGenerating) return;

    if (isTemporaryId(idToClear)) {
      setMessages([]);
      return;
    }

    try {
      const updatedConv = await clearConversation(idToClear);
      if (idToClear === activeConversationId) {
        setMessages([]);
      }
      setConversations((prev) =>
        prev.map((c) =>
          c.id === idToClear
            ? { ...c, title: updatedConv?.title || 'New Chat' }
            : c
        )
      );
    } catch (err) {
      setErrorMessage(err.message || 'Failed to clear conversation.');
    }
  };

  // 7. Send message & SSE Streaming via POST /api/chat/
  const handleSendMessage = async (optionalText) => {
    const messageText = (optionalText || input).trim();
    if (!messageText || isGenerating || isSendingRef.current) return;

    isSendingRef.current = true;
    setErrorMessage(null);

    // Immediately display user message in UI
    const tempUserMsg = {
      id: `temp-usr-${Date.now()}`,
      role: 'user',
      content: messageText,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, tempUserMsg]);
    setInput('');
    setIsGenerating(true);
    setStreamingAssistantText('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    let accumulatedTokens = '';

    try {
      await streamChat({
        conversationId: isTemporaryId(activeConversationId) ? null : activeConversationId,
        message: messageText,
        signal: controller.signal,
        onMeta: (meta) => {
          // If conversation_id was created or changed (e.g. promoting a temporary chat)
          if (meta?.conversation_id) {
            const realId = meta.conversation_id;
            setActiveConversationId(realId);
            setConversations((prev) => {
              const hasTemp = prev.some((c) => isTemporaryId(c.id));
              if (hasTemp) {
                return prev.map((c) =>
                  isTemporaryId(c.id)
                    ? {
                        id: realId,
                        title: 'New Chat',
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        isTemporary: false,
                      }
                    : c
                );
              }
              const exists = prev.some((c) => c.id === realId);
              if (exists) return prev;
              return [
                {
                  id: realId,
                  title: 'New Chat',
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                  isTemporary: false,
                },
                ...prev,
              ];
            });
          }
          // Update temporary user message ID with real backend UUID
          if (meta?.user_message_id) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === tempUserMsg.id ? { ...m, id: meta.user_message_id } : m
              )
            );
          }
        },
        onToken: (delta) => {
          accumulatedTokens += delta;
          setStreamingAssistantText(accumulatedTokens);
        },
        onDone: (doneData) => {
          // Finalize assistant message with backend-persisted ID
          const finalAssistantMsg = {
            id: doneData?.assistant_message_id || `asst-${Date.now()}`,
            role: 'assistant',
            content: accumulatedTokens,
            created_at: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, finalAssistantMsg]);
          setStreamingAssistantText('');
          setIsGenerating(false);

          // Update conversation title in sidebar if updated by backend
          const targetId = doneData?.conversation_id || activeConversationId;
          if (doneData?.title && targetId) {
            setConversations((prev) =>
              prev.map((c) =>
                c.id === targetId || isTemporaryId(c.id)
                  ? {
                      ...c,
                      id: targetId,
                      title: doneData.title,
                      updated_at: new Date().toISOString(),
                      isTemporary: false,
                    }
                  : c
              )
            );
          }
        },
        onError: (err) => {
          setErrorMessage(err.message || 'Error generating AI response.');
          setIsGenerating(false);
          // If partial text arrived before error, keep it in chat history
          if (accumulatedTokens) {
            setMessages((prev) => [
              ...prev,
              {
                id: `asst-${Date.now()}`,
                role: 'assistant',
                content: accumulatedTokens,
                created_at: new Date().toISOString(),
              },
            ]);
            setStreamingAssistantText('');
          }
        },
      });
    } catch (err) {
      if (
        err?.name === 'AbortError' ||
        controller.signal.aborted ||
        (err?.message && err.message.toLowerCase().includes('abort'))
      ) {
        // Aborted by user: preserve user message and clean up streaming state
        setIsGenerating(false);
        setStreamingAssistantText('');
        return;
      }
      setErrorMessage(err.message || 'Connection error with backend.');
      setIsGenerating(false);
      setStreamingAssistantText('');
    } finally {
      abortControllerRef.current = null;
      isSendingRef.current = false;
    }
  };

  // 8. Stop Generation via AbortController
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setStreamingAssistantText('');
  };

  return (
    <div className="chatbot-app-layout">
      <Sidebar
        conversations={conversations}
        activeId={activeConversationId}
        isLoadingConversations={isLoadingConversations}
        onSelectConversation={handleSelectConversation}
        onNewChat={handleNewChat}
        onDeleteConversation={handleDeleteConversation}
        onClearConversation={handleClearChat}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        language={language}
        onSelectLanguage={handleSelectLanguage}
      />

      <ChatArea
        conversation={activeConversation}
        messages={messages}
        streamingAssistantText={streamingAssistantText}
        input={input}
        setInput={setInput}
        onSend={(prompt) => handleSendMessage(prompt)}
        onStop={handleStopGeneration}
        onClearChat={handleClearChat}
        onOpenMobileSidebar={() => setIsOpenMobile(true)}
        isGenerating={isGenerating}
        isLoadingMessages={isLoadingMessages}
        errorMessage={errorMessage}
        onDismissError={() => setErrorMessage(null)}
        onRetry={loadInitialConversations}
      />
    </div>
  );
}
