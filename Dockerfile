# Build Stage
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

# Copy pom.xml and resolve dependencies first for efficient layer caching
COPY pom.xml .
RUN mvn dependency:resolve -B || true

# Copy source code and package application into an executable JAR
COPY src ./src
RUN mvn clean package -DskipTests -B

# Runtime Stage
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Create a non-root group and user for security
RUN addgroup -S spring && adduser -S spring -G spring

# Copy packaged jar from build stage
COPY --from=build /app/target/*.jar app.jar

# Give user write access to /app so counter.json & notes.json can be written at runtime
RUN chown -R spring:spring /app

USER spring:spring

# Configure default port and optimize JVM memory for Render's 512MB free tier
ENV PORT=8080
ENV JAVA_TOOL_OPTIONS="-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Xss512k -Djava.security.egd=file:/dev/./urandom"

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
