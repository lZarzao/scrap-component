# DataHarvest Pipeline Service

A production-grade web scraping and data pipeline system built with Node.js, TypeScript, BullMQ, and PostgreSQL.

## 📋 Project Overview

This application orchestrates web scraping workers, manages job queues with retry and failure handling, transforms raw scraped data, stores clean records in a database, and exposes results through a REST API.

### Key Features

- ✅ **Layer-Based Event-Driven Architecture** - Loosely coupled components communicating via queues
- ✅ **Queue Management** - BullMQ with Redis for job orchestration
- ✅ **Retry Policies** - Exponential and linear backoff strategies
- ✅ **Dead Letter Queue** - Failed job handling and manual retry
- ✅ **Graceful Shutdown** - 30-second grace period for in-flight jobs
- ✅ **Structured Logging** - JSON logs with Pino
- ✅ **Health Checks** - Database and Redis connectivity monitoring
- ✅ **TypeScript** - Full type safety with strict mode
- ✅ **Docker Support** - Complete containerization with docker-compose

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    SCHEDULER (Cron)                          │
│  - Books: Daily at 02:00 UTC                                 │
│  - HN: Every 15 minutes                                      │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│             QUEUE: scrape:pending (Redis/BullMQ)             │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│               SCRAPER WORKERS (3 concurrent)                 │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│              QUEUE: scrape:raw (Redis/BullMQ)                │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│             TRANSFORMER (5 concurrent)                       │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│           QUEUE: scrape:processed (Redis/BullMQ)             │
└───────────────────────┬──────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────┐
│               PERSISTER (2 concurrent)                       │
│                      ↓                                       │
│                 PostgreSQL                                   │
└──────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20 LTS or higher
- Docker & Docker Compose (recommended)
- PostgreSQL 16 (if not using Docker)
- Redis 7 (if not using Docker)

### Option 1: Using Docker (Recommended)

1. **Clone and setup**

```bash
cd scrap-component
cp .env.example .env
```

2. **Start all services**

```bash
docker compose up -d
```

3. **Run database migrations**

```bash
docker compose exec app npm run migrate:latest
```

4. **Check logs**

```bash
docker compose logs -f app
```

5. **Verify health**

```bash
curl http://localhost:3000/api/v1/health
```

### Option 2: Local Development (Without Docker)

1. **Install dependencies**

```bash
npm install
```

2. **Start PostgreSQL and Redis**

```bash
# Using Homebrew on macOS
brew services start postgresql@16
brew services start redis

# Or using other methods based on your OS
```

3. **Configure environment**

```bash
cp .env.example .env
# Edit .env with your local database credentials
```

4. **Run database migrations**

```bash
npm run migrate:latest
```

5. **Start development server**

```bash
npm run dev
```

## 📂 Project Structure

```
scrap-component/
├── src/
│   ├── index.ts                 # Application entry point
│   ├── config.ts                # Environment configuration
│   ├── logger.ts                # Structured logging
│   ├── db/
│   │   ├── client.ts            # Database client
│   │   └── migrations/          # Database migrations
│   │       ├── 001_create_scrape_jobs.ts
│   │       ├── 002_create_books.ts
│   │       └── 003_create_hn_stories.ts
│   ├── queue/
│   │   └── queues.ts            # BullMQ queue configuration
│   ├── scheduler/
│   │   ├── index.ts             # Cron scheduler
│   │   └── jobFactory.ts        # Job creation factory
│   └── workers/
│       ├── scraperWorker.ts     # BullMQ scraper worker
│       ├── rateLimiter.ts       # Rate limiting
│       └── scrapers/
│           ├── booksScraper.ts  # Books scraper
│           └── hnScraper.ts     # Hacker News scraper
├── dist/                        # Compiled JavaScript (generated)
├── Dockerfile                   # Application container
├── docker-compose.yml           # Infrastructure setup
├── tsconfig.json                # TypeScript configuration
├── knexfile.ts                  # Database migrations config
├── .env.example                 # Environment variables template
└── package.json                 # Dependencies and scripts

```

## 🔧 Configuration

All configuration is managed through environment variables. Copy `.env.example` to `.env` and customize as needed.

```bash
cp .env.example .env
```

### Key Environment Variables

| Variable                  | Description                                    | Default            | Required |
| ------------------------- | ---------------------------------------------- | ------------------ | -------- |
| **Application**           |
| `NODE_ENV`                | Environment mode (development/production/test) | `development`      | No       |
| `PORT`                    | HTTP server port                               | `3000`             | No       |
| **Database**              |
| `DB_HOST`                 | PostgreSQL hostname                            | `localhost`        | Yes      |
| `DB_PORT`                 | PostgreSQL port                                | `5432`             | No       |
| `DB_USER`                 | Database username                              | `dataharvest_user` | Yes      |
| `DB_PASSWORD`             | Database password                              | `dataharvest_pass` | Yes      |
| `DB_NAME`                 | Database name                                  | `dataharvest`      | Yes      |
| **Redis**                 |
| `REDIS_HOST`              | Redis hostname                                 | `localhost`        | Yes      |
| `REDIS_PORT`              | Redis port                                     | `6379`             | No       |
| **Queue Concurrency**     |
| `SCRAPER_CONCURRENCY`     | Max concurrent scraper workers                 | `3`                | No       |
| `TRANSFORMER_CONCURRENCY` | Max concurrent transformer workers             | `5`                | No       |
| `PERSISTER_CONCURRENCY`   | Max concurrent persister workers               | `2`                | No       |
| **Rate Limiting**         |
| `MIN_REQUEST_DELAY_MS`    | Minimum delay between HTTP requests (ms)       | `1000`             | No       |
| **Scheduling**            |
| `BOOKS_CRON`              | Cron schedule for Books scraping               | `0 2 * * *`        | No       |
| `HN_CRON`                 | Cron schedule for HN scraping                  | `*/15 * * * *`     | No       |
| **Logging**               |
| `LOG_LEVEL`               | Logging level (info/debug/warn/error)          | `info`             | No       |
| **Bull Board Dashboard**  |
| `BULL_BOARD_ENABLED`      | Enable Bull Board dashboard                    | `true`             | No       |
| `BULL_BOARD_USERNAME`     | Dashboard username                             | `admin`            | Yes\*    |
| `BULL_BOARD_PASSWORD`     | Dashboard password                             | -                  | Yes\*    |

\*Required if `BULL_BOARD_ENABLED=true`

**Note:** For Docker deployments, use service names as hostnames (e.g., `DB_HOST=app-postgres`, `REDIS_HOST=app-redis`). For local development, use `localhost`.

See `.env.example` for the complete list of available configuration options.

## 📊 Database Schema

### Tables

1. **scrape_jobs** - Tracks all scraping jobs
   - `id` (UUID, PK)
   - `source` (books | hackernews)
   - `status` (pending | processing | completed | failed)
   - `triggered_at`, `started_at`, `completed_at`
   - `error_message`, `metadata`

2. **books** - Scraped book data
   - `id` (UUID, PK)
   - `upc` (UNIQUE) - Natural dedup key
   - `title`, `price_gbp`, `rating`, `category`
   - `available`, `description`, `num_reviews`
   - `scraped_at`, `updated_at`

3. **hn_stories** - Hacker News stories
   - `id` (UUID, PK)
   - `hn_item_id` (UNIQUE) - Natural dedup key
   - `title`, `url`, `score`, `author`
   - `age_text`, `comment_count`, `story_type`
   - `scraped_at`, `updated_at`

## 🛠️ Available Scripts

| Script                     | Description                              |
| -------------------------- | ---------------------------------------- |
| `npm run dev`              | Start development server with hot reload |
| `npm run build`            | Compile TypeScript to JavaScript         |
| `npm start`                | Start production server                  |
| `npm run lint`             | Run ESLint                               |
| `npm run lint:fix`         | Fix ESLint errors                        |
| `npm run format`           | Format code with Prettier                |
| `npm test`                 | Run tests with Vitest                    |
| `npm run test:watch`       | Run tests in watch mode                  |
| `npm run test:ui`          | Run tests with UI                        |
| `npm run test:coverage`    | Run tests with coverage report           |
| `npm run migrate:latest`   | Run pending migrations                   |
| `npm run migrate:rollback` | Rollback last migration                  |

## 🧪 Testing

The project uses **Vitest** as the testing framework with comprehensive unit tests.

### Test Coverage

Current coverage: **89.05%** (exceeds 70% requirement)

```
File               | % Stmts | % Branch | % Funcs | % Lines
-------------------|---------|----------|---------|--------
All files          |   89.05 |     85.5 |   80.64 |   90.83
 transformers      |   97.18 |    90.19 |     100 |    97.1
 validators        |     100 |       75 |     100 |     100
 workers           |     100 |      100 |     100 |     100
```

### Test Structure

```
tests/
├── unit/
│   ├── transformers/
│   │   ├── bookTransformer.test.ts (16 tests)
│   │   └── hnTransformer.test.ts (17 tests)
│   ├── validators/
│   │   └── schemas.test.ts (27 tests)
│   └── rateLimiter.test.ts (14 tests)
└── integration/ (to be added)
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI dashboard
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### Test Categories

- **Transformer Tests** - Data transformation and validation
- **Schema Tests** - Zod schema validation
- **Rate Limiter Tests** - Rate limiting behavior
- **Integration Tests** - End-to-end pipeline tests (planned)

## 📡 API Endpoints

### Job Management

- `POST /api/v1/jobs/trigger` - Manually trigger a scrape job

### Example Job Trigger

```bash
# Trigger books scrape
curl -X POST http://localhost:3000/api/v1/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{"source":"books"}'

# Trigger Hacker News scrape
curl -X POST http://localhost:3000/api/v1/jobs/trigger \
  -H "Content-Type: application/json" \
  -d '{"source":"hackernews"}'
```

Response:

```json
{
  "success": true,
  "jobId": "a1b2c3d4-e5f6-7890-1234-567890abcdef",
  "source": "books",
  "message": "Scrape job triggered successfully"
}
```

### Using Postman Collection

A complete Postman collection is included in the repository: `DataHarvest_Pipeline.postman_collection.json`

**Import Instructions:**

1. Open Postman
2. Click **Import** button
3. Select the `DataHarvest_Pipeline.postman_collection.json` file
4. The collection includes all endpoints with examples and tests

**Collection Features:**

- ✅ All 20+ endpoints organized by category
- ✅ Pre-configured request bodies
- ✅ Automatic variable extraction (jobId, UPC, HN item ID)
- ✅ Response tests for validation
- ✅ Query parameter examples with descriptions
- ✅ Detailed endpoint documentation

**Collection Variables:**

- `baseUrl`: http://localhost:3000 (configurable)
- `jobId`: Auto-populated from trigger responses
- `bookUpc`: Auto-populated from book list
- `hnItemId`: Auto-populated from story list

## 📊 How to Monitor Queue Status

There are multiple ways to monitor the queue system and job processing:

### Method 1: Bull Board Dashboard (Visual)

**Best for:** Real-time visual monitoring and manual operations

Access the interactive dashboard:

```
URL: http://localhost:3000/admin/queues
Credentials: admin / [your password from .env]
```

**Features:**

- ✅ Real-time queue statistics (waiting, active, completed, failed)
- ✅ Visual job inspection with full payload
- ✅ Manual job retry and deletion
- ✅ Performance graphs and metrics
- ✅ Clean up completed/failed jobs in bulk

**Use Cases:**

- Monitor jobs during development
- Debug failed jobs with stack traces
- Retry jobs after fixing issues
- Clean up old jobs

### Method 2: Metrics API Endpoint

**Best for:** Programmatic monitoring and alerting

```bash
curl http://localhost:3000/api/v1/metrics
```

**Response Example:**

```json
{
  "queues": {
    "scrape:pending": {
      "waiting": 0,
      "active": 1,
      "completed": 79,
      "failed": 2,
      "delayed": 0
    },
    "scrape:raw": { ... },
    "scrape:processed": { ... },
    "scrape:dlq": { ... }
  },
  "throughput": {
    "last_hour": {
      "completed": 156,
      "failed": 4,
      "avg_latency_ms": 2350
    }
  },
  "sources": {
    "books": {
      "last_success": "2026-05-11T02:00:00.000Z",
      "total_runs": 45
    },
    "hackernews": {
      "last_success": "2026-05-11T15:30:00.000Z",
      "total_runs": 280
    }
  }
}
```

**Use Cases:**

- Automated monitoring scripts
- Integration with alerting systems
- Dashboard creation
- Performance tracking

### Method 3: Prometheus Metrics

**Best for:** Production monitoring with Grafana/Prometheus

```bash
curl http://localhost:3000/metrics
```

**Response Format:** Prometheus text format

```
# HELP dataharvest_queue_depth Number of jobs in queue by state
# TYPE dataharvest_queue_depth gauge
dataharvest_queue_depth{queue="scrape-pending",state="waiting"} 0
dataharvest_queue_depth{queue="scrape-pending",state="completed"} 79

# HELP dataharvest_jobs_processed_total Total number of processed jobs
# TYPE dataharvest_jobs_processed_total counter
dataharvest_jobs_processed_total{queue="scrape-pending",status="completed"} 79
```

**Use Cases:**

- Prometheus scraping
- Grafana dashboards
- Alert rules (e.g., DLQ depth > 10)
- Historical trend analysis

### Additional Monitoring Options

**Application Logs:**

```bash
# View all logs
docker compose logs -f app

# Filter for job-related logs
docker compose logs app | grep "Job"
```

**Database Inspection:**

```bash
# Connect to PostgreSQL
docker compose exec postgres psql -U dataharvest_user -d dataharvest

# Check recent jobs
SELECT id, source, status, triggered_at, completed_at
FROM scrape_jobs
ORDER BY triggered_at DESC
LIMIT 10;

# Exit
\q
```

**Redis CLI:**

```bash
# Connect and check queue lengths
docker compose exec redis redis-cli
LLEN bullmq:scrape:pending
exit
```

## ⚠️ Known Limitations and Trade-offs

### 1. Static HTML Scraping Only

**Limitation:** Uses Cheerio for parsing, which only works with static HTML.

**Impact:** Cannot scrape JavaScript-rendered content or handle CAPTCHA challenges.

**Mitigation:** Both target sites (Books to Scrape, Hacker News) serve static HTML, so this works perfectly for the assessment requirements.

**Trade-off:** Chose simplicity and speed over flexibility. For JS-heavy sites, Puppeteer/Playwright would be needed (bonus challenge available).

### 2. BullMQ vs pg-boss

**Decision:** BullMQ (Redis-backed)

**Rationale:** Better performance for high concurrency, lower latency, rich ecosystem (Bull Board).

**Trade-off:** Requires Redis as a separate service, but Redis is common in modern stacks and provides significant performance benefits.

### 3. Fixed Concurrency Limits

**Limitation:** Worker concurrency (scrapers: 3, transformers: 5, persisters: 2) is configured at startup.

**Impact:** Cannot auto-scale based on load.

**Mitigation:** Limits are configurable via environment variables and can be adjusted per environment.

### 4. No Data Versioning

**Limitation:** UPSERT overwrites existing records without keeping history.

**Impact:** Cannot track price changes over time or maintain audit trail.

**Mitigation:** `scraped_at` and `updated_at` timestamps provide basic tracking. Sufficient for current requirements.

### 5. Single Instance Deployment

**Limitation:** Application designed to run as a single instance.

**Impact:** No horizontal scaling or redundancy.

**Mitigation:** BullMQ supports multiple workers. Can deploy multiple instances sharing Redis/PostgreSQL for production.

### 6. Basic Security

**Limitation:** Bull Board uses HTTP Basic Auth (Base64), REST API has no authentication.

**Impact:** Suitable for development/internal tools only.

**Mitigation:** Dashboard can be disabled in production. Network-level restrictions (VPN, firewall) recommended for production deployments.

---

These limitations are intentional trade-offs balancing development time, complexity, and current requirements. Each limitation includes mitigation strategies that can be implemented based on specific production needs.

## 🔍 API Endpoints

### Health & Metrics

- `GET /api/v1/health` - Health check (database + Redis connectivity)
- `GET /api/v1/metrics` - Queue metrics and process stats

### Example Health Check Response

```json
{
  "status": "healthy",
  "timestamp": "2026-05-08T10:30:00.000Z",
  "uptime": 3600.5,
  "environment": "development"
}
```

## 📚 API Documentation (OpenAPI/Swagger)

This project includes a fully documented OpenAPI 3.1 specification served via Swagger UI.

### Accessing the Documentation

- **Interactive UI:** [http://localhost:3000/api/docs](http://localhost:3000/api/docs)
- **JSON Spec:** [http://localhost:3000/api/docs/spec](http://localhost:3000/api/docs/spec)

### Features

- ✅ Complete API documentation for all 12 endpoints
- ✅ Request/Response schemas with examples
- ✅ Interactive "Try it out" functionality
- ✅ OpenAPI 3.1 compliant
- ✅ Automatic schema validation
- ✅ Detailed endpoint descriptions and parameters

### Documented Endpoints

| Method | Endpoint                        | Description                         |
| ------ | ------------------------------- | ----------------------------------- |
| POST   | `/api/v1/jobs/trigger`          | Manually trigger a scrape job       |
| GET    | `/api/v1/jobs`                  | List all scrape jobs (with filters) |
| GET    | `/api/v1/jobs/:id`              | Get single job by ID                |
| GET    | `/api/v1/jobs/dlq`              | Inspect Dead Letter Queue           |
| DELETE | `/api/v1/jobs/dlq/:jobId`       | Remove job from DLQ                 |
| POST   | `/api/v1/jobs/dlq/:jobId/retry` | Retry failed job                    |
| GET    | `/api/v1/books`                 | List scraped books (with filters)   |
| GET    | `/api/v1/books/:upc`            | Get book by UPC                     |
| GET    | `/api/v1/stories`               | List HN stories (with filters)      |
| GET    | `/api/v1/stories/:hn_item_id`   | Get story by HN item ID             |
| GET    | `/api/v1/metrics`               | Get system metrics                  |
| GET    | `/api/v1/health`                | Health check                        |

### Value Added

The OpenAPI documentation provides:

1. **Developer Experience**: New developers can understand the API instantly without reading code
2. **Client Generation**: The spec can generate client SDKs in multiple languages
3. **API Testing**: Interactive UI allows testing endpoints without curl/Postman
4. **Contract-First Development**: Ensures API design consistency
5. **Integration Ready**: Standard format for API gateways and monitoring tools

## 📊 Prometheus Metrics

This project exposes comprehensive metrics in Prometheus text format for monitoring and observability.

### Accessing Metrics

- **Endpoint:** [http://localhost:3000/metrics](http://localhost:3000/metrics)
- **Format:** Prometheus text format (compatible with Prometheus server scraping)
- **Content-Type:** `text/plain; version=0.0.4; charset=utf-8`

### Available Metrics

#### Process & Node.js Metrics (Default)

- `dataharvest_process_cpu_*` - CPU usage metrics
- `dataharvest_process_resident_memory_bytes` - Memory usage
- `dataharvest_nodejs_eventloop_lag_*` - Event loop performance
- `dataharvest_nodejs_heap_*` - V8 heap statistics
- `dataharvest_nodejs_active_handles_total` - Active libuv handles

#### Queue Metrics (Custom)

- `dataharvest_queue_depth{queue, state}` - Jobs by queue and state
  - States: `waiting`, `active`, `completed`, `failed`, `delayed`
  - Queues: `scrape-pending`, `scrape-raw`, `scrape-processed`, `scrape-dlq`
- `dataharvest_jobs_processed_total{queue, status}` - Counter of processed jobs
- `dataharvest_job_processing_duration_seconds{queue, status}` - Processing time histogram

#### Database Metrics (Custom)

- `dataharvest_database_records_total{table}` - Total records per table
  - Tables: `books`, `hn_stories`, `scrape_jobs`
- `dataharvest_database_operations_total{operation, table, status}` - Database operations counter

#### Health Metrics (Custom)

- `dataharvest_health_check{component}` - Health status (1=healthy, 0=unhealthy)
  - Components: `database`, `redis`

#### Scraping Metrics (Custom)

- `dataharvest_scrape_requests_total{source, status}` - Total scrape requests
- `dataharvest_scrape_request_duration_seconds{source}` - Scrape duration histogram
- `dataharvest_scraped_records_total{source, type}` - Total records scraped

#### Rate Limiter Metrics (Custom)

- `dataharvest_rate_limiter_delays_total{host}` - Rate limiter delay count
- `dataharvest_rate_limiter_delay_duration_seconds{host}` - Delay duration histogram

### Example Output

```prometheus
# HELP dataharvest_queue_depth Number of jobs in queue by state
# TYPE dataharvest_queue_depth gauge
dataharvest_queue_depth{queue="scrape-pending",state="waiting"} 0
dataharvest_queue_depth{queue="scrape-pending",state="completed"} 79

# HELP dataharvest_database_records_total Total number of records in database
# TYPE dataharvest_database_records_total gauge
dataharvest_database_records_total{table="books"} 100
dataharvest_database_records_total{table="hn_stories"} 60

# HELP dataharvest_health_check Health check status (1 = healthy, 0 = unhealthy)
# TYPE dataharvest_health_check gauge
dataharvest_health_check{component="database"} 1
dataharvest_health_check{component="redis"} 1
```

### Integration with Prometheus

Add this scrape configuration to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'dataharvest-pipeline'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

### Value Added

The Prometheus metrics provide:

1. **Real-Time Monitoring**: Track queue depths, processing rates, and system health
2. **Performance Analysis**: Histogram metrics for latency and duration tracking
3. **Alerting**: Set up alerts based on queue depth, error rates, or health checks
4. **Historical Data**: Prometheus stores time-series data for trend analysis
5. **Dashboard Integration**: Compatible with Grafana for visual dashboards
6. **Standard Format**: Industry-standard format used by Kubernetes, Docker, and cloud platforms

### Use Cases

- **Queue Monitoring**: Alert when DLQ jobs exceed threshold
- **Performance Tracking**: Track scraping duration and identify bottlenecks
- **Resource Management**: Monitor memory usage and event loop lag
- **Uptime Tracking**: Monitor database and Redis connectivity
- **Capacity Planning**: Analyze trends to predict scaling needs

## 🎛️ BullMQ Dashboard

This project includes Bull Board, a visual dashboard for monitoring and managing BullMQ queues in real-time.

### Accessing the Dashboard

- **URL:** [http://localhost:3000/admin/queues](http://localhost:3000/admin/queues)
- **Authentication:** HTTP Basic Auth (username/password required)
- **Default Credentials:**
  - Username: `admin` (configurable via `BULL_BOARD_USERNAME`)
  - Password: Set in `.env` file (`BULL_BOARD_PASSWORD`)

### Features

✅ **Real-Time Queue Monitoring**

- View all 4 queues: `scrape-pending`, `scrape-raw`, `scrape-processed`, `scrape-dlq`
- Live updates of queue statistics (waiting, active, completed, failed, delayed)
- Visual indicators for queue health and status

✅ **Job Inspection**

- Inspect individual job details and payloads
- View job progress and timestamps
- See error messages and stack traces for failed jobs

✅ **Job Management**

- Retry failed jobs manually from the dashboard
- Clean up completed/failed jobs in bulk
- Promote delayed jobs to immediate execution

✅ **Performance Metrics**

- Processing time per job
- Job completion rates
- Error rates and failure patterns
- Queue throughput statistics

✅ **Security**

- Protected with HTTP Basic Authentication
- Credentials configured via environment variables
- Unauthorized access attempts are logged

### Configuration

Configure Bull Board via environment variables in `.env`:

| Variable              | Description              | Default         | Required |
| --------------------- | ------------------------ | --------------- | -------- |
| `BULL_BOARD_ENABLED`  | Enable/disable dashboard | `true`          | No       |
| `BULL_BOARD_PATH`     | Dashboard URL path       | `/admin/queues` | No       |
| `BULL_BOARD_USERNAME` | Login username           | `admin`         | Yes      |
| `BULL_BOARD_PASSWORD` | Login password           | -               | **Yes**  |

### Example Configuration

```bash
# .env file
BULL_BOARD_ENABLED=true
BULL_BOARD_PATH=/admin/queues
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=Your_Secure_Password_123!
```

### Security Best Practices

⚠️ **Important Security Notes:**

1. **Set a Strong Password**: Use a long, random password (minimum 20 characters)
2. **Use HTTPS**: Always use HTTPS in production (Basic Auth sends credentials in Base64)
3. **Rotate Credentials**: Change passwords regularly
4. **IP Whitelisting**: Consider restricting access to specific IP addresses/VPN
5. **Access Logging**: All authentication attempts are logged

### Accessing the Dashboard

1. Open your browser and navigate to `http://localhost:3000/admin/queues`
2. Enter your credentials when prompted:
   - Username: `admin` (or your configured username)
   - Password: Your configured password from `.env`
3. The dashboard will display all 4 queues with real-time statistics

### Use Cases

- **Development**: Monitor jobs during local development
- **Debugging**: Inspect failed jobs and retry them manually
- **Operations**: Monitor queue health and performance in production
- **Troubleshooting**: View job payloads and error messages
- **Maintenance**: Clean up old completed/failed jobs

### Value Added

Bull Board provides:

1. **Visual Monitoring**: See queue status at a glance without CLI commands
2. **Faster Debugging**: Inspect job payloads and errors interactively
3. **Manual Intervention**: Retry failed jobs without API calls
4. **Team Collaboration**: Share live queue status with team members
5. **Production Operations**: Monitor and manage queues in production environments

### Screenshots

When you access the dashboard, you'll see:

- **Queue List**: All 4 queues with job counts by status
- **Job Details**: Click any job to see full payload and metadata
- **Actions**: Buttons to retry, delete, or promote jobs
- **Statistics**: Real-time charts and metrics

### Disabling the Dashboard

To disable Bull Board (e.g., in production for security):

```bash
# .env
BULL_BOARD_ENABLED=false
```

The dashboard route will not be registered, and the middleware won't be loaded.

## 📚 Technology Stack

| Technology | Purpose       | Version |
| ---------- | ------------- | ------- |
| Node.js    | Runtime       | 20 LTS  |
| TypeScript | Language      | ^5.x    |
| Express.js | HTTP server   | ^4.x    |
| BullMQ     | Queue system  | ^5.x    |
| Redis      | Queue storage | 7       |
| PostgreSQL | Database      | 16      |
| Knex.js    | Query builder | ^3.x    |
| Pino       | Logger        | ^8.x    |
| Zod        | Validation    | ^3.x    |
| Cheerio    | HTML parser   | ^1.x    |
| Axios      | HTTP client   | ^1.x    |
| node-cron  | Scheduler     | ^3.x    |

## 🐛 Debugging

### Check Docker Services

```bash
docker compose ps
docker compose logs postgres
docker compose logs redis
docker compose logs app
```

### Check Database

```bash
docker compose exec postgres psql -U dataharvest_user -d dataharvest -c "\dt"
```

### Check Redis

```bash
docker compose exec redis redis-cli KEYS "bull:*"
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f app
```

## 🔐 Security

- ✅ No secrets in repository
- ✅ `.gitignore` configured for `.env` files
- ✅ Strict TypeScript mode
- ✅ Input validation with Zod
- ✅ Error handling for unhandled rejections and exceptions

## 📄 License

MIT

## 👤 Author

Luis Zarza

---

**Status**: ✅ **PRODUCTION READY**

**Stack**: Node.js 20 LTS • TypeScript • Express • BullMQ • PostgreSQL • Redis • Docker • Prometheus • Bull Board
