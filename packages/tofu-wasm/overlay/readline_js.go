// Adds the platform layer chzyer/readline lacks on js/wasm, backed by the
// browser terminal's JS tty object.

package readline

import (
	"io"
	"syscall"
	"syscall/js"
)

type State struct{ raw bool }

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

func IsTerminal(fd int) bool {
	return ttyCall("isatty", fd)
}

func MakeRaw(fd int) (*State, error) {
	return &State{raw: ttyCall("setRaw", true)}, nil
}

func GetState(fd int) (*State, error) {
	return &State{raw: tty().Truthy() && tty().Get("raw").Truthy()}, nil
}

func restoreTerm(fd int, s *State) error {
	ttyCall("setRaw", s.raw)
	return nil
}

func GetSize(fd int) (int, int, error) {
	return ttyInt("cols", 80), ttyInt("rows", 24), nil
}

func ReadPassword(fd int) ([]byte, error) {
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

func SuspendMe() {}

func GetScreenWidth() int {
	w, _, _ := GetSize(syscall.Stdout)
	return w
}

func ClearScreen(w io.Writer) (int, error) {
	return w.Write([]byte("\033[H"))
}

func DefaultIsTerminal() bool {
	return IsTerminal(syscall.Stdin) && (IsTerminal(syscall.Stdout) || IsTerminal(syscall.Stderr))
}

func GetStdin() int { return syscall.Stdin }

func DefaultOnWidthChanged(func()) {}
