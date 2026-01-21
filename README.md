## Drive

**Drive** is a storage space designed to be user-friendly and act as a friendly storage solution for users.

## Key features

- **Secure Authentication**: User registration and login system using JWT tokens and password hashing.
- **Smart Storage**: All the files are stored in AWS S3.
- **Resumable uploads**: All the folders and files can resumed upload in case connection breaks.
- **File Management**: Upload, view, and search files effortlessly.
- **Sharing feature**: Share the files and folders with peers.
- **Built-in Code Editor**: Edit code files directly in the browser with an integrated Monaco Editor.
- **Dockerized Deployment**: Easy setup and deployment using Docker and Docker Compose.

## System architecture

The application follows a decoupled client-server architecture:

Frontend is build on React+Vite and backend is built upon Python(fastapi)
service that handles business logic and api endpoints.
We use mongodb as database to store the file structure ,other settings and configs such as permissions. AWS S3 is utilized for storing the actual file content.

### Workflow

To access the drive user must be authenticated. Once user wants to upload file or folder to drive.Metadata is generated which notifies the backend to maintain the required pointers so that entire file tree can constructed. Then backend generates **presigned url** which enables user to directly upload data to the S3 bucket. This means actual data never touches the server. The entire data is encrypted by AWS S3 and is secured.This ensures faster uploads and reduces server bandwidth usage.

To handle the sharing we generate an alias for a given file or folder with proper permissions so that shared person does not change the files.

The system can handle substring matching for the files and folder paths using metadata present.

### Design

The user is assigned a uuid which acts as the root of file system. Each uploaded file or folder is assigned a uuid which means system can handle two files or folders in the same folder. The backend generates the file system tree when the user wants to explore the file tree.Once generated the going of back and forth in the file system is just traversal along the tree. System contains two kinds of nodes first of type folders or links these are the intermediate nodes from root and leaf node which can file or folder in case its empty.

1.  **Direct-to-Cloud Uploads**:
    *   When a user uploads a file, the backend generates a **Pre-signed URL**.
    *   The frontend uses this URL to upload the file directly to S3, bypassing the backend server. This ensures faster uploads and reduces server bandwidth usage.

2.  **Secure Downloads**:
    *   Files are private by default. When a user requests a file, the backend verifies permissions and generates a temporary **Pre-signed Download URL**.
    *   This URL allows the browser to access the file directly from S3 for a limited time.

3.  **Folder Key Structure**:
    *   S3 uses a flat structure, but we simulate folders logically.
    *   Files are stored with keys formatted as: `{user_id}/{resource_id}/{filename}`.
    *   This structure avoids naming collisions and simplifies access control.

## Tech stack

- **Front-end**: React+Vite
- **Back-end**: Fast-api
- **Containerization**: Docker, Docker Compose
- **Database**: MongoDB
- **Infrastructure**: S3

## Security

Security is a top priority in Drive:
- **Data Protection**: All sensitive user data, including passwords, are hashed using **Bcrypt** before storage.
- **Access Control**: API endpoints are protected via JWT tokens, ensuring only authorized access.
- **Data isolation**: Entire data is encrypted and cannot be accessed outside the application.

## Future enhancements

There is always room for growth. Here are some planned features:
- **Version Control**: Keep track of file changes and restore previous versions.
- **File management**: Advanced file movement options like copy and paste. 