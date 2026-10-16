FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git && \
    go install github.com/sanisideup/jira-cli-for-agents@latest

FROM alpine:3.21
RUN apk add --no-cache ca-certificates
COPY --from=builder /go/bin/jira-cli-for-agents /usr/local/bin/jcfa
ENTRYPOINT ["jcfa"]
