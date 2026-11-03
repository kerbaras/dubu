// Replaces filesystem_lock_unix.go for js/wasm. A browser tab runs one tofu
// process at a time, so advisory file locks have nothing to guard.

package flock

import (
	"context"
	"os"
)

func Lock(*os.File) error { return nil }

func LockBlocking(context.Context, *os.File) error { return nil }

func Unlock(*os.File) error { return nil }
