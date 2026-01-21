# World Clock Application

## Overview

A world clock web application that allows users to track time across multiple time zones. Users can add cities, reorder them with drag and drop functionality, and view times at a glance. The application features a hero clock display for the selected timezone and supports light/dark theme modes.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, built using Vite
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack React Query for server state, React useState for local state
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **UI Components**: shadcn/ui component library (Radix UI primitives with custom styling)
- **Drag and Drop**: @dnd-kit for sortable timezone tiles
- **Date/Time**: date-fns and date-fns-tz for timezone-aware date formatting

### Backend Architecture
- **Runtime**: Node.js with Express
- **Server Structure**: Single Express server handling both API routes and static file serving
- **Build System**: Custom build script using esbuild for server and Vite for client
- **Development**: Vite dev server with HMR proxied through Express

### Data Storage
- **Current Implementation**: Browser localStorage for persisting user timezone preferences
- **Database Config**: Drizzle ORM configured with PostgreSQL (schema defined in shared/schema.ts, though not actively used for this client-side app)
- **Schema Design**: Timezone data validated using Zod schemas with predefined available timezones

### Project Structure
```
├── client/           # React frontend application
│   └── src/
│       ├── components/   # UI components including shadcn/ui
│       ├── pages/        # Page components (world-clock, not-found)
│       ├── hooks/        # Custom React hooks
│       └── lib/          # Utilities and providers
├── server/           # Express backend
│   ├── index.ts      # Server entry point
│   ├── routes.ts     # API route registration
│   └── static.ts     # Static file serving
├── shared/           # Shared code between client and server
│   └── schema.ts     # Zod schemas and timezone data
└── script/           # Build scripts
```

### Weather API
- **External API**: Open-Meteo (free, no API key required)
- **Endpoint**: GET /api/weather?city={zoneKey}
- **Response**: { celsius: number, fahrenheit: number }
- **Caching**: Server-side 10-minute cache, client-side React Query stale time of 10 minutes
- **Temperature Colors**:
  - Blue (text-blue-500): <= 0°C (freezing)
  - Cyan (text-cyan-500): 1-10°C (cold)
  - Green (text-green-500): 11-18°C (cool)
  - Yellow (text-yellow-500): 19-24°C (mild)
  - Orange (text-orange-500): 25-30°C (warm)
  - Red (text-red-500): > 30°C (hot)

### Key Design Decisions
1. **Client-side data persistence**: Timezone preferences stored in localStorage rather than a database, making the app work without authentication
2. **Shared schema**: Zod schemas shared between client and server for type safety and validation
3. **Theme system**: CSS custom properties with class-based dark mode switching
4. **Component architecture**: shadcn/ui components provide consistent, accessible UI primitives
5. **Weather integration**: Open-Meteo API provides real-time temperatures without API key requirements

## External Dependencies

### Core Libraries
- **React 18**: Frontend framework
- **Express**: Backend web server
- **Vite**: Development server and build tool
- **Drizzle ORM**: Database toolkit (configured for PostgreSQL)

### UI Libraries
- **Radix UI**: Headless UI primitives for accessible components
- **Tailwind CSS**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **Lucide React**: Icon library

### Utility Libraries
- **date-fns / date-fns-tz**: Date manipulation and timezone handling
- **@dnd-kit**: Drag and drop functionality
- **Zod**: Schema validation
- **TanStack React Query**: Async state management

### Database
- **PostgreSQL**: Configured via DATABASE_URL environment variable
- **Drizzle Kit**: Database migration tooling

### Development Tools
- **TypeScript**: Type checking
- **esbuild**: Server bundling
- **Replit plugins**: Development banner and error overlay for Replit environment