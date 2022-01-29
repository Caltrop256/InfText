compile :
	@clang \
		-Ofast -Wall -Wextra --target=wasm32 --no-standard-libraries -Wno-unused-parameter -Wno-switch\
		-Wl,--no-entry -Wl,--export-dynamic \
		-o static/client.wasm \
		$(shell find ./c -name '*.c')