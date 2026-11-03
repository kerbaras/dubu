// Package providers serves a curated set of upstream Terraform providers
// in-process. OpenTofu reaches them through TF_REATTACH_PROVIDERS over Go's
// in-memory js/wasm network, so no plugin subprocesses are needed.
package providers

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"github.com/hashicorp/terraform-plugin-framework/provider"
	"github.com/hashicorp/terraform-plugin-framework/providerserver"
	"github.com/hashicorp/terraform-plugin-go/tfprotov5/tf5server"
)

const namespace = "registry.opentofu.org/hashicorp/"

type reattachAddr struct {
	Network string
	String  string
}

type reattach struct {
	Protocol        string
	ProtocolVersion int
	Pid             int
	Test            bool
	Addr            reattachAddr
}

// Start launches every bundled provider and returns the TF_REATTACH_PROVIDERS
// value describing them.
func Start() (string, error) {
	out := make(map[string]reattach, len(bundled))
	for name, factory := range bundled {
		cfg, err := serve(namespace+name, factory)
		if err != nil {
			return "", fmt.Errorf("provider %s: %w", name, err)
		}
		out[namespace+name] = cfg
	}
	b, err := json.Marshal(out)
	return string(b), err
}

func serve(addr string, factory func() provider.Provider) (reattach, error) {
	ch := make(chan *plugin.ReattachConfig, 1)
	errCh := make(chan error, 1)
	go func() {
		errCh <- tf5server.Serve(addr, providerserver.NewProtocol5(factory()),
			tf5server.WithDebug(context.Background(), ch, nil),
			tf5server.WithGoPluginLogger(hclog.NewNullLogger()),
		)
	}()
	select {
	case rc := <-ch:
		return reattach{
			Protocol:        string(rc.Protocol),
			ProtocolVersion: rc.ProtocolVersion,
			Pid:             rc.Pid,
			Test:            true,
			Addr:            reattachAddr{rc.Addr.Network(), rc.Addr.String()},
		}, nil
	case err := <-errCh:
		return reattach{}, fmt.Errorf("server exited: %v", err)
	}
}
