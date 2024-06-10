# BUILDER
ARG BASE_IMAGE
FROM $BASE_IMAGE AS builder

RUN echo "Building opentrack"
# Need path to get to wineg++
ENV PATH="/opt/wine-staging/bin:$PATH"


# Get the opentrack source code
WORKDIR /build
RUN git clone https://github.com/opentrack/opentrack

# Build opentrack
WORKDIR /build/opentrack
ENV CPLUS_INCLUDE_PATH=/opt/wine-staging/include/wine/windows
RUN cmake -DSDK_WINE=ON .
RUN make
RUN make install

FROM $BASE_IMAGE AS built

# Copy files from builder stage
COPY --from=builder /build/opentrack/install/ /builds/opentrack/

# This is needed so we can keep our container open so that subsequent
# docker cp commands can be run. Docker stop will exit fast after files are copied.
COPY images/opentrack/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
CMD ["docker-entrypoint.sh"]