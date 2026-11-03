package speakeasy

import (
	"syscall"
	"syscall/js"
)

func getPassword() (string, error) {
	tty := js.Global().Get("__tofuTTY")
	old := tty.Call("setEcho", false).Bool()
	defer tty.Call("setEcho", old)
	var line []byte
	buf := make([]byte, 1)
	for {
		n, err := syscall.Read(syscall.Stdin, buf)
		if n == 0 || err != nil || buf[0] == '\n' {
			return string(line), err
		}
		line = append(line, buf[0])
	}
}
