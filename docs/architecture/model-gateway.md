# Model gateway

Server-only calls for the plan split, step cards, the stuck story, the rest reply and the return pop-up. Each call parses, cleans and checks the answer (with the per-run list), regenerates with the failure reason within a time limit, and otherwise returns an explicit failure with no stored text

Path: `src/lib/model-gateway/`
