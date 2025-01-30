# GitLab Gantt Visualizer

A web application that visualizes GitLab project issues in a Gantt chart format.

## Features

- Connect to GitLab projects using API token
- Display project issues in a Gantt chart
- Filter issues by labels and milestones
- Interactive timeline with drag-and-drop support
- Export chart as PNG

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file with the following content:
   ```
   PORT=3000
   CORS_ORIGIN=http://localhost:5173
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open your browser and visit `http://localhost:5173`

## Usage

1. Get your GitLab API token:
   - Go to GitLab > Settings > Access Tokens
   - Create a new token with `api` scope
   - Copy the token

2. Find your project ID:
   - Go to your GitLab project
   - The project ID is displayed on the project's home page

3. Enter these details in the application:
   - Paste your project ID
   - Paste your GitLab API token
   - Click "Connect"

4. The Gantt chart will display your project's issues
   - Issues are shown with their start and end dates
   - You can filter issues by labels
   - Drag and drop to adjust dates
   - Export the chart as needed

## Development

The project is structured as follows:

- `backend/`: Express.js + TypeScript backend
  - `src/`: Source code
    - `index.ts`: Main entry point
    - `routes/`: API routes
    - `types/`: TypeScript type definitions

- `frontend/`: React + TypeScript frontend
  - `src/`: Source code
    - `App.tsx`: Main application component
    - `components/`: React components
    - `types/`: TypeScript type definitions

## License

ISC