# BUILDER
ARG BASE_IMAGE
FROM $BASE_IMAGE AS builder

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

CMD ["/bin/bash"]