/**
 * Mock data for Phase F1 UI layout and prototype interactions.
 * In Phase F2, this will be replaced with real Django REST calls.
 */

export const INITIAL_CONVERSATIONS = [
  {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    title: 'Understanding Python Generators',
    updatedAt: '10 mins ago',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Can you explain how Python generators work and why they are memory efficient?',
        timestamp: '10:24 AM',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content:
          'Python generators are functions that produce a sequence of values on-the-fly using the `yield` statement rather than returning a complete collection all at once.\n\n### Key Benefits:\n1. **Memory Efficiency**: Values are calculated one at a time (*lazy evaluation*). A generator producing 1,000,000 items uses virtually the same memory as one producing 10.\n2. **State Preservation**: When `yield` is hit, the generator pauses execution and preserves its entire execution frame and local variables until `next()` is called again.\n3. **Pipelines**: You can chain generators together like Unix pipes to process large datasets or streaming data seamlessly.',
        timestamp: '10:24 AM',
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'Can you show a quick code example comparing a list comprehension vs generator expression?',
        timestamp: '10:25 AM',
      },
      {
        id: 'msg-4',
        role: 'assistant',
        content:
          'Here is a quick comparison:\n\n```python\nimport sys\n\n# List comprehension: builds the entire list in memory immediately\nnumbers_list = [x * 2 for x in range(1000000)]\nprint("List size:", sys.getsizeof(numbers_list), "bytes")  # ~8.4 MB\n\n# Generator expression: creates values on demand\nnumbers_gen = (x * 2 for x in range(1000000))\nprint("Generator size:", sys.getsizeof(numbers_gen), "bytes")  # ~200 bytes!\n```\n\nThe generator uses almost 40,000x less memory!',
        timestamp: '10:25 AM',
      },
    ],
  },
  {
    id: 'c82f9d6b-7389-4a92-9cb8-b2ef3f5a1a12',
    title: 'Django REST Framework & SSE Streaming',
    updatedAt: '2 hours ago',
    messages: [
      {
        id: 'msg-201',
        role: 'user',
        content: 'How does Django handle Server-Sent Events (SSE) streaming with DRF?',
        timestamp: '8:45 AM',
      },
      {
        id: 'msg-202',
        role: 'assistant',
        content:
          'Django handles SSE through `StreamingHttpResponse` with `content_type="text/event-stream"`. It streams data chunks formatted as `event: <name>\\ndata: <json>\\n\\n` without blocking the entire response cycle.',
        timestamp: '8:46 AM',
      },
    ],
  },
  {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    title: 'Modern React Architecture',
    updatedAt: 'Yesterday',
    messages: [
      {
        id: 'msg-301',
        role: 'user',
        content: 'What are the main advantages of using Vite over Create React App?',
        timestamp: 'Yesterday',
      },
      {
        id: 'msg-302',
        role: 'assistant',
        content:
          'Vite leverages native ES modules during development and esbuild for pre-bundling. It provides near-instant server start and lightning-fast Hot Module Replacement (HMR) regardless of application size.',
        timestamp: 'Yesterday',
      },
    ],
  },
];

export const STARTER_PROMPTS = [
  {
    icon: '⚡',
    title: 'Explain Server-Sent Events',
    prompt: 'Explain how Server-Sent Events (SSE) work in Django and how they differ from WebSockets.',
  },
  {
    icon: '🐍',
    title: 'Python Memory Optimization',
    prompt: 'What are the best practices for optimizing memory and CPU usage in Python web apps?',
  },
  {
    icon: '🎨',
    title: 'Clean Component Design',
    prompt: 'How should I structure a React 18 component hierarchy for maximum reusability and performance?',
  },
  {
    icon: '🔒',
    title: 'AI Security Best Practices',
    prompt: 'Why should AI provider API keys always remain on the backend and never be sent to the browser?',
  },
];

export const MOCK_REPLIES = [
  'That is a great question! In modern web applications, keeping concerns separated between backend and frontend provides superior security and maintainability.',
  'Here is what you should consider: first, ensure proper error handling and fallback states. Second, keep state localized to the components that need it.',
  'I can certainly help with that! Let us look at the architecture step by step to find the most elegant solution.',
  'Thanks for asking! That is an essential pattern when designing scalable, resilient systems with real-time streaming capabilities.',
];
