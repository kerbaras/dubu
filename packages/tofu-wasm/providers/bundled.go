package providers

import (
	"github.com/hashicorp/terraform-plugin-framework/provider"

	http "github.com/opentofu/opentofu/playground/build/providers/http/provider"
	local "github.com/opentofu/opentofu/playground/build/providers/local/provider"
	null "github.com/opentofu/opentofu/playground/build/providers/null/provider"
	random "github.com/opentofu/opentofu/playground/build/providers/random/provider"
	timep "github.com/opentofu/opentofu/playground/build/providers/time/provider"
)

// bundled lists the providers compiled into the playground binary. Their
// sources are copied from the pinned upstream modules by gen-providers.sh.
var bundled = map[string]func() provider.Provider{
	"http":   http.New,
	"local":  local.New,
	"null":   null.New,
	"random": random.New,
	"time":   timep.New,
}
