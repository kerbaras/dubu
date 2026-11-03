package logging

import (
	"io"
	"os"
)

// providerStderr keeps in-process provider logs (trace-level JSON that tofu
// would normally filter from a plugin's stderr) out of the terminal unless
// provider logging was explicitly requested.
func providerStderr(stderr io.Writer) io.Writer {
	if os.Getenv("TF_LOG") != "" || os.Getenv("TF_LOG_PROVIDER") != "" {
		return stderr
	}
	return io.Discard
}
