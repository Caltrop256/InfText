#include "main.h"
#include "chunk.h"
#include "walloc.h"

export void decodeChunkSequence(u32 *data) {
    u32 hI = 0;
    u32 nChunks = data[hI++];
    u32 headLength = nChunks * 5 + 1;

    while(hI < headLength) {
        i64 x0 = data[hI++];
        i64 x1 = data[hI++];
        i64 y0 = data[hI++];
        i64 y1 = data[hI++];
        u32 ind = data[hI++];

        u32 *chunk = malloc(ChunkLength * sizeof(u32));
        if(!ind) {
            u32 i = ChunkLength;
            while(i --> 0) chunk[i] = Blank;
        } else {
            u32 i = 0;
            u32 bI = ind + headLength;
            while(i < ChunkLength) {
                u16 rl = (data[bI] >> 24) + 1;
                u32 val = data[bI++] & 0xffffff;
                while(rl --> 0) chunk[i++] = val;
            }
        }

        __callback(x0, x1, y0, y1, chunk);
        free(chunk);
    }

    free(data);
}