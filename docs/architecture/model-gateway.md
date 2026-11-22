# Model gateway

Server-only calls for the plan split, step cards, the pause message (two calls since #56: the stuck story, then his words about it), the rest reply and the return pop-up. Each call parses, cleans and checks the answer (with the per-run list), regenerates with the failure reason within a time limit, and otherwise returns an explicit failure with no stored text

Path: `src/lib/model-gateway/`
