# NIGHTCODE - PROJECT REPORT

## Executive Summary
**Nightcode** is a modern, full-stack web-based code editor platform designed to provide an integrated coding experience with AI-powered assistance, real-time collaboration, and comprehensive language support. The application combines a React frontend with a Node.js backend, leveraging the Monaco Editor and OpenAI-compatible APIs for intelligent code completion and assistance.

---

## Project Overview

| Aspect | Details |
|--------|---------|
| **Project Name** | Nightcode |
| **Version** | 0.1.0 |
| **Type** | Full-Stack Web Application |
| **Primary Framework** | React 18 + TypeScript |
| **Build Tool** | Vite 6.0.5 |
| **Runtime** | Node.js with WebSocket Support |

---

## Technology Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript 5.6.3** - Type-safe development
- **Monaco Editor 0.52.0** - Advanced code editing capabilities
- **Framer Motion 11.0** - Smooth UI animations
- **Lucide React 0.468** - Icon library
- **Zustand 5.0.2** - State management
- **Vite 6.0.5** - Lightning-fast build tool

### Backend & Services
- **Node.js** - Server runtime
- **WebSocket (ws 8.21.3)** - Real-time bidirectional communication
- **OpenAI-compatible API** - AI code assistance integration

---

## Core Features

### 1. **Multi-Language Code Editor**
Supports 14+ programming languages including TypeScript/React, JavaScript, Python, Java, C/C++, Go, Rust, PHP, Ruby, HTML, CSS, and JSON with syntax highlighting and proper language detection.

### 2. **AI-Powered Copilot**
Integrates with OpenAI or compatible LLM providers via `/api/copilot/chat` endpoint. Features include:
- Customizable conversation tones (professional, friendly, unhinged)
- Context-aware assistance with file and content awareness
- Full message history support for continuous conversations

### 3. **Real-Time Collaboration**
WebSocket-based (`/api/collaboration`) system enabling:
- Multi-user presence tracking
- Live file change synchronization
- Client-to-client message routing with unique client IDs

### 4. **Code Management**
- Multiple file editor with tab interface
- Editable files: `src/App.tsx`, `src/styles.css`, `package.json`, `vite.config.ts`, `index.html`
- File-specific language detection and syntax highlighting
- Persistent file state management

### 5. **Customization & Analytics**
- Theme switching with persistent accent colors (violet, lime, pink, cyan)
- Coding statistics tracking (`/api/stats`)
- Code snippet management with reaction/voting system (`/api/snippets`)
- Sidebar navigation with responsive UI

---

## Project Structure

```
nightcode/
├── src/                        # Frontend source code
│   ├── App.tsx                # Main React component
│   ├── main.tsx               # Entry point
│   ├── styles.css             # Global styling
│   └── api/                   # API client layer
│       ├── copilot.ts         # AI assistance integration
│       ├── collaboration.ts   # Real-time collab WebSocket
│       ├── stats.ts           # Analytics API
│       ├── snippets.ts        # Code snippets management
│       └── themes.ts          # Theme management
├── server/                     # Backend services
│   ├── services/
│   │   └── ai.ts              # OpenAI API bridge
│   └── data/                  # Persistent data files
│       ├── stats.json
│       ├── snippets.json
│       └── themes.json
├── vite.config.ts            # Build & server configuration
├── tsconfig.json             # TypeScript configuration
├── package.json              # Dependencies & scripts
└── index.html                # HTML entry point
```

---

## API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/copilot/chat` | POST | AI code assistance |
| `/api/collaboration` | WebSocket | Real-time multi-user editing |
| `/api/stats` | GET | Coding statistics |
| `/api/snippets` | GET/POST | Code snippet management |
| `/api/themes` | GET/POST | Theme configuration |

---

## Development & Build

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start development server with Vite |
| `npm run build` | TypeScript compilation + production build |
| `npm run typecheck` | Type validation without building |
| `npm run lint` | Run linting (type checking) |
| `npm run preview` | Preview production build locally |

---

## Configuration Requirements

To run the application, the following environment variables must be configured on the server:
- **`AI_API_KEY`** - OpenAI or compatible API key (required)
- **`AI_BASE_URL`** - Custom AI provider endpoint (optional, defaults to OpenAI)
- **`AI_MODEL`** - LLM model name (optional, defaults to `gpt-4o-mini`)

---

## Key Architectural Highlights

1. **Modular API Design** - Separation of concerns with dedicated modules for each feature (copilot, collaboration, stats, snippets, themes)
2. **State Management** - Zustand store for centralized, lightweight state handling
3. **WebSocket Collaboration** - Real-time file synchronization with presence tracking
4. **Type-Safe Development** - Full TypeScript implementation across frontend and backend
5. **Build Optimization** - Vite's fast refresh and production optimizations

---

## Project Status & Maturity
- **Version**: Pre-release (0.1.0)
- **Primary Use Case**: Development/Educational tool for collaborative coding with AI assistance
- **Deployment Ready**: Requires configuration of AI API credentials

---

*Generated on 2026-09-01*
