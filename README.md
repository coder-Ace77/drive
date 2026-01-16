# Drive

**Drive** is a storage space designed to be user-friendly and act as a friendly storage solution for users. It combines a robust backend with a sleek, modern frontend to provide seamless file management and editing capabilities.

## Key features

- **Secure Authentication**: Robust user registration and login system using JWT tokens and password hashing.
- **File Management**: Upload, view, and organize files effortlessly.
- **Smart Storage**: frequent metadata access via MongoDB and scalable object storage using AWS S3.
- **Built-in Code Editor**: Edit code files directly in the browser with an integrated Monaco Editor.
- **Responsive Design**: A modern, mobile-responsive interface built with React and TailwindCSS.
- **Dockerized Deployment**: Easy setup and deployment using Docker and Docker Compose.

## System architecture

The application follows a decoupled client-server architecture:

- **Frontend**: A Single Page Application (SPA) built with **React** and **Vite**, communicating with the backend via RESTful APIs. It handles user interactions, file rendering, and the code editing experience.
- **Backend**: A **FastAPI** (Python) service that handles business logic, authentication, and API endpoints. It utilizes **Beanie** as an ODM for MongoDB interactions.
- **Database**: **MongoDB** is used as the primary database for storing user metadata, file structures, and permission settings.
- **Object Storage**: **AWS S3** is utilized for storing the actual file content, ensuring high availability and scalability.

### S3 Architecture & Workflow

The application leverages AWS S3 for efficient and secure file handling, minimizing server load:

1.  **Direct-to-Cloud Uploads**:
    *   When a user uploads a file, the backend generates a **Pre-signed URL**.
    *   The frontend uses this URL to upload the file directly to S3, bypassing the backend server. This ensures faster uploads and reduces server bandwidth usage.
    *   Once the upload is complete, the frontend notifies the backend to index the file metadata (name, size, type) in MongoDB.

2.  **Secure Downloads**:
    *   Files are private by default. When a user requests a file, the backend verifies permissions and generates a temporary **Pre-signed Download URL**.
    *   This URL allows the browser to access the file directly from S3 for a limited time.

3.  **Folder Key Structure**:
    *   S3 uses a flat structure, but we simulate folders logically.
    *   Files are stored with keys formatted as: `{user_id}/{resource_id}/{filename}`.
    *   This structure avoids naming collisions and simplifies access control.

4.  **Folder Downloads (Zip)**:
    *   For folder downloads, the backend temporarily downloads the requested files from S3, compresses them into a ZIP archive on the fly, and streams it to the client.

## Tech stack

**Frontend**
- **Framework**: React, TypeScript, Vite
- **Styling**: TailwindCSS
- **Editor**: Monaco Editor
- **Icons**: Lucide React
- **State/Routing**: React Router DOM, Axios

**Backend**
- **Framework**: FastAPI (Python)
- **Database ODM**: Beanie (MongoDB), Motor
- **Storage SDK**: Boto3 (AWS S3)
- **Security**: Passlib (Bcrypt), Python-Jose (JWT)

**Infrastructure**
- **Containerization**: Docker, Docker Compose
- **Database**: MongoDB

## Security

Security is a top priority in Drive:
- **Data Protection**: All sensitive user data, including passwords, are hashed using **Bcrypt** before storage.
- **Access Control**: API endpoints are protected via **OAuth2** compatible JWT tokens, ensuring only authorized access.
- **CORS Policies**: Strict Cross-Origin Resource Sharing (CORS) configurations to prevent unauthorized domain access.
- **Environment Isolation**: Sensitive configuration (DB URLs, API keys) is managed via environment variables (`.env`).

## Future enhancements

There is always room for growth. Here are some planned features:
- **File Sharing**: Generate shareable links for files and folders with expiry options.
- **Version Control**: Keep track of file changes and restore previous versions.
- **Advanced Search**: Full-text search capability to find files by content and metadata.
- **Collaborative Editing**: Real-time collaboration on code and text files.
- **Folder Download**: Download entire folders as ZIP archives.
