#include <stdint.h>

#ifndef MAIN_H
#define MAIN_H

typedef uint8_t     u8;
typedef int8_t      i8;
typedef uint16_t    u16;
typedef int16_t     i16;
typedef uint32_t    u32;
typedef int32_t     i32;
typedef uint64_t    u64;
typedef int64_t     i64;
typedef float       f32;
typedef double      f64;

#define export __attribute__((visibility("default")))
#define import(x) __attribute__((import_module("env"), import_name(#x)))

#define NULL ((void *)0)

import(callback) void __callback();

#endif