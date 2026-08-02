# Grocery Backend (Spring Boot)

Spring Boot replacement for the original MERN backend, with the same REST API paths and response contracts expected by the existing frontend.

## Tech Stack

- Java 17+
- Spring Boot 3.3.8
- Maven Wrapper (`mvnw`, `mvnw.cmd`)
- Spring Web
- Spring Data JPA
- MySQL
- Spring Security (JWT)
- Spring Validation
- Lombok

## Project Structure

```text
src/main/java/com/groceryapp
├── controller
├── service
├── repository
├── model
├── dto
├── config
├── security
└── exception
```

## Important Files

- [pom.xml](/d:/smart%20bridge%20project/spring_back/pom.xml)
- [application.properties](/d:/smart%20bridge%20project/spring_back/src/main/resources/application.properties)
- [MIGRATION_MAPPING.md](/d:/smart%20bridge%20project/spring_back/MIGRATION_MAPPING.md)
- [API_ENDPOINTS.md](/d:/smart%20bridge%20project/spring_back/API_ENDPOINTS.md)

## Configuration

Default settings in `application.properties`:

- `server.port=8080`
- `spring.datasource.url=jdbc:mysql://localhost:3306/grocerydb?createDatabaseIfNotExist=true&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC`
- `spring.datasource.username=root`
- `spring.datasource.password=`

Core environment variables:

- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`

Common optional variables:

- `CORS_WHITELIST` (default `http://localhost:4200`)
- `BCRYPT_SALT_ROUNDS`
- `DEFAULT_DELIVERY_FEE`
- `FREE_DELIVERY_THRESHOLD`
- `TAX_PERCENT`
- `LOW_STOCK_DEFAULT_THRESHOLD`
- `PAYMENT_PROVIDER`
- `PAYMENT_WEBHOOK_SECRET`
- `FRONTEND_BASE_URL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `SMS_WEBHOOK_URL`
- `SERVICEABLE_PINCODES`

## Run Instructions

1. Ensure MySQL is running and accessible using the configured `spring.datasource.*` settings.
2. Set required env vars:
   - Windows PowerShell:
     ```powershell
     $env:JWT_ACCESS_SECRET="replace_with_secure_secret"
     $env:JWT_REFRESH_SECRET="replace_with_secure_secret"
     ```
3. Start the backend:
   - Windows:
     ```powershell
     .\mvnw.cmd spring-boot:run
     ```
   - macOS/Linux:
     ```bash
     ./mvnw spring-boot:run
     ```
4. Verify:
   ```bash
   curl -s http://localhost:8080/health
   ```

## Test Instructions

```powershell
.\mvnw.cmd test
```

## Connect Existing Frontend

No API path changes are needed. Keep frontend calls to existing `/api/...` endpoints.

Use one of these integration options:

1. Frontend environment base URL:
   - Point API base URL to `http://localhost:8080`.
2. Dev proxy:
   - If frontend currently proxies `/api` to Node port `5000`, update proxy target to `http://localhost:8080`.
3. Reverse proxy:
   - Route `/api/*` and `/health` to Spring Boot service.

## Notes on Compatibility

- Endpoint paths and HTTP methods are preserved.
- Mongo document field names are preserved for existing data compatibility.
- JWT auth + role access controls are preserved.
- Error responses are standardized JSON and include validation/auth/domain errors.
