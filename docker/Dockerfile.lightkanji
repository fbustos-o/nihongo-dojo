# syntax=docker/dockerfile:1
FROM ghcr.io/cirruslabs/flutter:3.44.0 AS build
ARG RUN_TESTS=false
ENV PUB_CACHE=/root/.pub-cache
WORKDIR /app
RUN git config --global --add safe.directory '*' \
 && flutter config --no-analytics \
 && dart --disable-analytics

COPY LightKanji/pubspec.yaml LightKanji/pubspec.lock ./
RUN flutter pub get

COPY LightKanji/ ./
RUN flutter pub get --offline
RUN if [ "$RUN_TESTS" = "true" ]; then flutter test; fi
RUN flutter build web --release

FROM nginx:1.29-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/build/web /usr/share/nginx/html
EXPOSE 80
