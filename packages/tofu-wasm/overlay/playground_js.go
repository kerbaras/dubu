package main

import (
	"os"

	"github.com/opentofu/opentofu/playground/providers"
)

func init() {
	if reattach, err := providers.Start(); err == nil && reattach != "" {
		os.Setenv("TF_REATTACH_PROVIDERS", reattach)
	}
}
