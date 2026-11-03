// Replaces golang.org/x/term/term_unsupported.go for js/wasm: the browser
// terminal (xterm.js) is a tty whose mode and size live on the JS side.

package term

import (
	"syscall"
	"syscall/js"
)

type state struct{ raw bool }

func tty() js.Value { return js.Global().Get("__tofuTTY") }

// ttyCall and ttyInt fall back to "not a terminal" when no JS tty exists
// (e.g. under Node's wasm_exec for tests).
func ttyCall(name string, args ...interface{}) bool {
	t := tty()
	if !t.Truthy() {
		return false
	}
	return t.Call(name, args...).Truthy()
}

func ttyInt(name string, def int) int {
	t := tty()
	if !t.Truthy() || !t.Get(name).Truthy() {
		return def
	}
	return t.Get(name).Int()
}

func isTerminal(fd int) bool {
	return ttyCall("isatty", fd)
}

func makeRaw(fd int) (*State, error) {
	old := ttyCall("setRaw", true)
	return &State{state{raw: old}}, nil
}

func getState(fd int) (*State, error) {
	return &State{state{raw: tty().Truthy() && tty().Get("raw").Truthy()}}, nil
}

func restore(fd int, s *State) error {
	ttyCall("setRaw", s.raw)
	return nil
}

func getSize(fd int) (width, height int, err error) {
	return ttyInt("cols", 80), ttyInt("rows", 24), nil
}

func readPassword(fd int) ([]byte, error) {
	return readLineNoEcho(fd)
}

func readLineNoEcho(fd int) ([]byte, error) {
	old := ttyCall("setEcho", false)
	defer ttyCall("setEcho", old)
	var line []byte
	buf := make([]byte, 1)
	for {
		n, err := syscall.Read(fd, buf)
		if n == 0 || err != nil {
			return line, err
		}
		if buf[0] == '\n' {
			return line, nil
		}
		line = append(line, buf[0])
	}
}
