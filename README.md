# 💳 Transaction Ledger API

[![Node.js Version](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express.js](https://img.shields.io/badge/Express-v5.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose%20v9.x-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![JWT Auth](https://img.shields.io/badge/JWT-Protected-000000?logo=jsonwebtokens&logoColor=white)](https://jwt.io/)
[![Nodemailer](https://img.shields.io/badge/Nodemailer-OAuth2-007ACC?logo=gmail&logoColor=white)](https://nodemailer.com/)

> **ACID-Compliant Double-Entry Ledger & Financial Transaction Management REST API.**  
> Built with Node.js, Express, MongoDB (Mongoose), JWT authentication with token blacklisting, atomic account locking, dynamic balance aggregation, and automated Nodemailer email alerts.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Core Features](#-core-features)
- [System Architecture & Flow](#-system-architecture--flow)
- [Database Schema Design](#-database-schema-design)
- [API Reference](#-api-reference)
  - [1. User Authentication (`/api/users`)](#1-user-authentication-apiusers)
  - [2. Account Management (`/api/accounts`)](#2-account-management-apiaccounts)
  - [3. Transaction Operations (`/api/transactions`)](#3-transaction-operations-apitransactions)
- [Idempotency & Concurrency Model](#-idempotency--concurrency-model)
- [Directory Structure](#-directory-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Configuration](#environment-configuration)
  - [Running the Application](#running-the-application)
- [Security & Integrity Measures](#-security--integrity-measures)

---

## 📖 Overview

The **Transaction Ledger API** is a high-integrity financial transaction backend engineered to guarantee ledger consistency, prevent double-spending, enforce request idempotency, protect against concurrent race conditions via atomic account locks, and maintain an immutable audit trail.

All transfers adhere to the **Double-Entry Bookkeeping** principle: every transaction simultaneously writes equal debit and credit records within a single atomic MongoDB multi-document session.

---

## ⚡ Core Features

- **Double-Entry Bookkeeping Ledger**: Every money movement creates linked `debit` and `credit` records in the `Ledger` collection.
- **Ledger Immutability Guards**: Mongoose pre-hooks block all update and delete actions on the `Ledger` model (`updateOne`, `updateMany`, `findOneAndUpdate`, `findByIdAndUpdate`, `deleteOne`, `deleteMany`, `findOneAndDelete`, `findOneAndReplace`, `remove`).
- **ACID Database Transactions**: Multi-document atomic transactions via Mongoose sessions (`startSession`, `startTransaction`, `commitTransaction`, `abortTransaction`) guarantee that either both debit and credit succeed or the transaction rolls back completely.
- **Atomic Account Locking**: Implements optimistic distributed locking on accounts (`isLocked: true`, `lockedUntil: +30s TTL`) during transfers to prevent simultaneous race conditions and concurrent double-debits.
- **Enforced Idempotency**: All transfer requests require a unique `idempotencyKey`. The system checks existing keys to prevent duplicate execution across client retries and network timeouts.
- **Dynamic Balance Aggregation**: Balances are calculated dynamically via a MongoDB aggregation pipeline over ledger entries ($\text{Total Credits} - \text{Total Debits}$) with optional transaction session support, avoiding out-of-sync mutable balance columns.
- **Paginated Transaction History & Filtering**: Advanced transaction ledger queries supporting filters by account, transaction type (`debit` / `credit`), status (`pending`, `success`, `failed`, `reversed`), date range (`startDate`, `endDate`), and pagination.
- **Authentication & JWT Blacklisting**:
  - Passwords hashed with `bcrypt` (salt rounds = 10).
  - JWT tokens delivered via HTTP-only cookies and `Authorization: Bearer <token>` headers.
  - Logging out invalidates the active token by adding it to the `tokenBlackList` collection.
  - Role-based authorization guard (`systemUser`) for privileged liquidity injections.
- **Automated Email Notifications**: Asynchronous email delivery for user registration and transaction confirmation via Nodemailer configured with Google OAuth2.

---

## 🏛 System Architecture & Flow

### Transaction Processing & Concurrency Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Auth as Auth Middleware
    participant Blacklist as Token Blacklist DB
    participant Controller as Transaction Controller
    participant DB as MongoDB (ACID Session)
    participant Email as Nodemailer (OAuth2)

    Client->>Auth: POST /api/transactions (Token + Payload)
    Auth->>Blacklist: Check if token is blacklisted
    alt Token Blacklisted
        Auth-->>Client: 401 Unauthorized ("Not authorized, token is blacklisted")
    end
    Auth->>Auth: Verify JWT & Attach req.user
    Auth->>Controller: Forward authenticated request

    Controller->>DB: Validate accounts, ownership & check idempotencyKey
    alt Idempotency Key Exists
        Controller-->>Client: Return existing status (409 Conflict / 200 Processing / 400 Failed)
    end
    alt Caller does not own source account
        Controller-->>Client: 403 Forbidden ("Unauthorized: You do not own the source account")
    end

    Controller->>DB: Atomically acquire 30s lock on fromAccount
    alt Account is already locked
        Controller-->>Client: 409 Conflict ("Another transaction is currently processing...")
    end

    Controller->>DB: Create Transaction record (status: 'pending')
    
    rect rgb(240, 248, 255)
        Note over Controller,DB: MongoDB ACID Transaction Session
        Controller->>DB: Start Session & Transaction
        Controller->>DB: Read session-locked balance via getBalance(session)
        alt Insufficient Balance
            Controller->>DB: Abort Session & Release Account Lock
            Controller-->>Client: 400 Bad Request ("Insufficient balance...")
        end
        Controller->>DB: Create Ledger DEBIT entry for fromAccount
        Controller->>DB: Create Ledger CREDIT entry for toAccount
        Controller->>DB: Update Transaction status = 'success'
        Controller->>DB: Commit Session
    end

    Controller->>DB: Release Account Lock (isLocked: false)
    Controller->>Email: Send transaction confirmation emails (Async)
    Controller-->>Client: 200 OK (Transaction details)
```

---

## 🗄 Database Schema Design

```mermaid
erDiagram
    USER ||--o{ ACCOUNT : owns
    ACCOUNT ||--o{ LEDGER : tracks
    TRANSACTION ||--|{ LEDGER : generates
    USER ||--o{ TOKEN_BLACKLIST : invalidates

    USER {
        ObjectId _id PK
        string name "Required, trim, lowercase"
        string email UK "Required, trim, lowercase, unique"
        string password "Required, bcrypt hashed"
        boolean systemUser "Default: false, immutable, select: false"
        date createdAt
        date updatedAt
    }

    ACCOUNT {
        ObjectId _id PK
        ObjectId user FK "Required, Indexed"
        string status "active | frozen | closed, Default: active"
        string currency "Default: INR"
        boolean isLocked "Default: false"
        date lockedUntil "Default: null (TTL Lock)"
        date createdAt
        date updatedAt
    }

    TRANSACTION {
        ObjectId _id PK
        ObjectId fromAccount FK "Required, Indexed"
        ObjectId toAccount FK "Required, Indexed"
        number amount "Required, min: 0"
        string status "pending | success | failed | reversed, Default: pending"
        string idempotencyKey UK "Required, Unique, Indexed"
        date createdAt
        date updatedAt
    }

    LEDGER {
        ObjectId _id PK
        ObjectId account FK "Required, Indexed, Immutable"
        ObjectId transaction FK "Required, Immutable"
        string type "debit | credit, Required, Immutable"
        number amount "Required, min: 0, Immutable"
        number balance "Required, Immutable"
        date createdAt
        date updatedAt
    }

    TOKEN_BLACKLIST {
        ObjectId _id PK
        string token UK "Required, Unique"
        date createdAt "Indexed"
        date updatedAt
    }
```

---

## 📡 API Reference

Base URL: `http://localhost:3000/api`

### 1. User Authentication (`/api/users`)

#### 🔹 Register User
Creates a new user account, returns a JWT token, sets an HTTP-only cookie, and sends a welcome email.

- **URL**: `POST /api/users/register`
- **Auth**: None
- **Body**:
  ```json
  {
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Responses**:
  - `201 Created`
    ```json
    {
      "success": true,
      "message": "User registered successfully",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "data": {
        "_id": "66bf04a9e2b5c12345678901",
        "name": "john doe",
        "email": "john@example.com",
        "createdAt": "2026-08-17T18:00:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Missing fields or user already exists.

---

#### 🔹 Login User
Authenticates user credentials and returns a JWT token via cookie and response.

- **URL**: `POST /api/users/login`
- **Auth**: None
- **Body**:
  ```json
  {
    "email": "john@example.com",
    "password": "password123"
  }
  ```
- **Responses**:
  - `200 OK`
    ```json
    {
      "success": true,
      "message": "Logged in successfully",
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
      "data": {
        "_id": "66bf04a9e2b5c12345678901",
        "name": "john doe",
        "email": "john@example.com"
      }
    }
    ```
  - `401 Unauthorized`: Invalid credentials.

---

#### 🔹 Logout User
Invalidates the current JWT token by saving it to the `tokenBlackList` collection and clearing the auth cookie.

- **URL**: `POST /api/users/logout`
- **Auth**: Required (`authMiddleware`)
- **Headers**: `Authorization: Bearer <token>` or HTTP-only cookie
- **Responses**:
  - `200 OK`
    ```json
    {
      "message": "Logged out successfully"
    }
    ```
  - `401 Unauthorized`: No token provided or token blacklisted.

---

### 2. Account Management (`/api/accounts`)

#### 🔹 Create Account
Creates a new financial account associated with the authenticated user.

- **URL**: `POST /api/accounts`
- **Auth**: Required (`authMiddleware`)
- **Responses**:
  - `201 Created`
    ```json
    {
      "success": true,
      "message": "Account created successfully",
      "data": {
        "_id": "66bf0581e2b5c12345678902",
        "user": "66bf04a9e2b5c12345678901",
        "status": "active",
        "currency": "INR",
        "isLocked": false,
        "lockedUntil": null,
        "createdAt": "2026-08-17T18:05:00.000Z",
        "updatedAt": "2026-08-17T18:05:00.000Z"
      }
    }
    ```

---

#### 🔹 Get User Accounts
Retrieves all accounts owned by the authenticated user.

- **URL**: `GET /api/accounts`
- **Auth**: Required (`authMiddleware`)
- **Responses**:
  - `200 OK`
    ```json
    {
      "success": true,
      "message": "Accounts fetched successfully",
      "data": [
        {
          "_id": "66bf0581e2b5c12345678902",
          "user": "66bf04a9e2b5c12345678901",
          "status": "active",
          "currency": "INR",
          "isLocked": false,
          "lockedUntil": null,
          "createdAt": "2026-08-17T18:05:00.000Z"
        }
      ]
    }
    ```

---

#### 🔹 Get Account Balance
Computes dynamic balance ($\sum \text{Credits} - \sum \text{Debits}$) from ledger entries for a specific account.

- **URL**: `GET /api/accounts/balance/:accountId`
- **Auth**: Required (`authMiddleware`)
- **Params**: `accountId` (MongoDB ObjectId)
- **Responses**:
  - `200 OK`
    ```json
    {
      "success": true,
      "message": "Account balance fetched successfully",
      "data": {
        "balance": 15000
      }
    }
    ```
  - `404 Not Found`: Account ID missing, account not found, or not owned by user.

---

### 3. Transaction Operations (`/api/transactions`)

#### 🔹 Create Transaction (Peer-to-Peer Transfer)
Performs an atomic money transfer between two active accounts, acquires an account lock, and generates double-entry ledger records.

- **URL**: `POST /api/transactions`
- **Auth**: Required (`authMiddleware`)
- **Body**:
  ```json
  {
    "fromAccount": "66bf0581e2b5c12345678902",
    "toAccount": "66bf0595e2b5c12345678903",
    "amount": 2500,
    "idempotencyKey": "unique-tx-key-12345"
  }
  ```
- **Responses**:
  - `200 OK`
    ```json
    {
      "success": true,
      "message": "Transaction created successfully",
      "transaction": {
        "_id": "66bf0631e2b5c12345678904",
        "fromAccount": "66bf0581e2b5c12345678902",
        "toAccount": "66bf0595e2b5c12345678903",
        "amount": 2500,
        "status": "success",
        "idempotencyKey": "unique-tx-key-12345",
        "createdAt": "2026-08-17T18:10:00.000Z",
        "updatedAt": "2026-08-17T18:10:00.000Z"
      }
    }
    ```
  - `400 Bad Request`: Insufficient balance, non-positive amount, transferring to same account, inactive accounts, or missing fields.
  - `403 Forbidden`: Authenticated user does not own the source account (`fromAccount`).
  - `404 Not Found`: Invalid source or destination account.
  - `409 Conflict`: Idempotency collision (already processed) or account is currently locked by another concurrent transaction.

---

#### 🔹 Initial Funds Deposit (`systemUser` Only)
Allows a system user (`systemUser: true`) to seed liquidity into a target user's account.

- **URL**: `POST /api/transactions/system/initialifund`
- **Auth**: Required (`authSystemMiddleware`)
- **Body**:
  ```json
  {
    "toAccount": "66bf0581e2b5c12345678902",
    "amount": 50000,
    "idempotencyKey": "sys-seed-key-0001"
  }
  ```
- **Responses**:
  - `200 OK` (Funds seeded, transaction completed)
  - `401 Unauthorized`: Calling user is not a verified `systemUser` or token is blacklisted.
  - `404 Not Found`: Target or source system account not found.

---

#### 🔹 Get Transaction History (Paginated & Filterable)
Retrieves paginated transaction records for an account owned by the user, with support for filtering by type, status, and date range.

- **URL**: `GET /api/transactions/history`
- **Auth**: Required (`authMiddleware`)
- **Query Parameters**:
  | Parameter | Type | Required | Description |
  | :--- | :--- | :--- | :--- |
  | `accountId` | String | **Yes** | MongoDB ObjectId of the account |
  | `page` | Number | No | Page number (default: `1`) |
  | `limit` | Number | No | Page limit (default: `10`, max: `50`) |
  | `type` | String | No | Filter by `'debit'` or `'credit'` (default: all) |
  | `status` | String | No | Filter by `'pending'`, `'success'`, `'failed'`, `'reversed'` |
  | `startDate` | Date String | No | ISO date string for start of date range |
  | `endDate` | Date String | No | ISO date string for end of date range |

- **Responses**:
  - `200 OK`
    ```json
    {
      "success": true,
      "data": [
        {
          "_id": "66bf0631e2b5c12345678904",
          "fromAccount": {
            "_id": "66bf0581e2b5c12345678902",
            "currency": "INR",
            "user": {
              "name": "john doe",
              "email": "john@example.com"
            }
          },
          "toAccount": {
            "_id": "66bf0595e2b5c12345678903",
            "currency": "INR",
            "user": {
              "name": "jane doe",
              "email": "jane@example.com"
            }
          },
          "amount": 2500,
          "status": "success",
          "idempotencyKey": "unique-tx-key-12345",
          "createdAt": "2026-08-17T18:10:00.000Z",
          "updatedAt": "2026-08-17T18:10:00.000Z"
        }
      ],
      "pagination": {
        "currentPage": 1,
        "limit": 10,
        "totalTransactions": 1,
        "totalPages": 1,
        "hasNextPage": false,
        "hasPreviousPage": false
      }
    }
    ```
  - `400 Bad Request`: Invalid `accountId` format.
  - `404 Not Found`: Account not found or not owned by the authenticated user.

---

## 🛡️ Idempotency & Concurrency Model

1. **Unique Key Indexing**: `Transaction.idempotencyKey` has an enforced unique database index.
2. **State Status Handling**:
   - `success`: Returns `409 Conflict` with the existing transaction data.
   - `pending`: Returns `200 OK` with `"Transaction is still processing"`.
   - `failed`: Returns `400 Bad Request` with `"Transaction has failed"`.
   - `reversed`: Returns `409 Conflict` with `"Transaction has been reversed"`.
3. **Optimistic Staging**: The transaction document is inserted with `status: "pending"` before starting the database transaction session, ensuring in-flight retries are immediately detected.
4. **Account Locking & Concurrency Control**:
   - When a transfer initiates, the source account is atomically locked (`isLocked: true`, `lockedUntil: +30s`).
   - If another transaction is active on the same account, a `409 Conflict` response is returned.
   - The lock is released on success or immediately in error/catch blocks.

---

## 📁 Directory Structure

```plaintext
transaction-ledger-api/
├── .env.example                     # Environment variables template
├── .gitignore                       # Git ignore patterns
├── package.json                     # Dependencies and scripts
├── server.js                        # App entry point and DB connection startup
├── README.md                        # Project documentation
└── src/
    ├── app.js                       # Express app configuration & route registration
    ├── config/
    │   └── db.js                    # Mongoose MongoDB connection helper
    ├── controllers/
    │   ├── account.controllers.js    # Account creation & balance queries
    │   ├── transaction.controllers.js# Atomic transactions, history & ledger generation
    │   └── user.controllers.js       # Register, login, logout & token blacklisting
    ├── middleware/
    │   └── auth.middleware.js        # authMiddleware & authSystemMiddleware
    ├── models/
    │   ├── account.models.js         # Account schema with locking & getBalance() aggregation
    │   ├── blackList.models.js       # Token blacklist schema
    │   ├── ledger.models.js          # Immutable double-entry ledger schema
    │   ├── transaction.models.js     # Transaction schema with idempotency key
    │   └── user.models.js            # User schema with bcrypt & token generation
    ├── routes/
    │   ├── account.routes.js         # /api/accounts routes
    │   ├── transaction.routes.js     # /api/transactions routes
    │   └── user.routes.js            # /api/users routes
    └── services/
        └── email.js                  # Nodemailer OAuth2 email service
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **MongoDB**: v6.0+ (MongoDB Atlas or a local replica set is required for multi-document ACID transactions)
- **Google OAuth2 Credentials**: Client ID, Client Secret, and Refresh Token (for Nodemailer)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Himanshux07/transaction-ledger-api.git
   cd transaction-ledger-api
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Environment Configuration

Create a `.env` file in the root directory:

```env
# MongoDB Connection String (Replica Set / MongoDB Atlas)
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.example.mongodb.net/transaction-ledger

# JWT Configuration
JWT_SECRET=your_secret_jwt_key
JWT_EXPIRES_IN=7d

# Google OAuth2 Email Credentials (Nodemailer)
EMAIL_USER=your_email@gmail.com
CLIENT_ID=your_client_id.apps.googleusercontent.com
CLIENT_SECRET=your_client_secret
REFRESH_TOKEN=your_oauth2_refresh_token
```

### Running the Application

- **Development Mode** (with automatic restart via nodemon):
  ```bash
  npm run dev
  ```

- **Production Mode**:
  ```bash
  npm start
  ```

The server listens by default on port `3000`.

---

## 🔒 Security & Integrity Measures

| Feature | Implementation |
| :--- | :--- |
| **Password Hashing** | Pre-save hook hashes passwords using `bcrypt` with salt rounds = 10. |
| **JWT Revocation** | Tokens are stored in [`tokenBlackList`](file:///c:/Users/Himan/OneDrive/1.Resource/MERN/transaction-ledger-api/src/models/blackList.models.js) on logout and blocked on subsequent requests. |
| **Ownership Authorization** | Verifies caller owns source account (`403 Forbidden` on unauthorized transfers). |
| **Account Concurrency Lock** | Atomic 30-second TTL lock (`isLocked`, `lockedUntil`) prevents simultaneous debits on the same account. |
| **Protected Sensitive Fields** | User passwords and `systemUser` flags are excluded by default in queries (`select: false`). |
| **Ledger Immutability** | Pre-hooks on the `Ledger` schema throw errors on any modification or deletion. |
| **No Overdrafts** | Dynamic aggregation checks total balance inside transaction session before transfer execution. |
| **Atomicity** | MongoDB multi-document transactions ensure rollback on partial execution failures. |
