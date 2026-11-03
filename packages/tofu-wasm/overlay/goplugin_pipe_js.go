package plugin

import (
	"io"
	"os"
	"strings"
)

// pluginPipe stands in for os.Pipe, which js/wasm lacks. The playground only
// serves providers in-process (test mode), where stdio is never forwarded.
func pluginPipe() (io.Reader, *os.File, error) {
	return strings.NewReader(""), nil, nil
}
