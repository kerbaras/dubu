package metrics

import "syscall"

// DefaultSignal is used with DefaultInmemSignal. js/wasm has no SIGUSR1.
const DefaultSignal = syscall.Signal(10)
