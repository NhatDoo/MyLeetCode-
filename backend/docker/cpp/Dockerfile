FROM gcc:13

RUN adduser --disabled-password --gecos "" sandbox

WORKDIR /app
COPY wrapper.sh /usr/local/bin/wrapper.sh
RUN chmod +x /usr/local/bin/wrapper.sh

RUN mkdir /sandbox && chown sandbox:sandbox /sandbox
USER sandbox

# Chạy wrapper qua runCmd từ executor
CMD ["/bin/sh"]
