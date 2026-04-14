NAME=audio-switch-shortcuts
DOMAIN=dbatis.github.com

OUTPUT_DIR=dist

.PHONY: all compile compile_schema translate pack install clean

all: compile compile_schema translate

node_modules: package.json
	npm install

compile: node_modules
	npx tsc

compile_schema: schemas/org.gnome.shell.extensions.audio-switch-shortcuts.gschema.xml
	glib-compile-schemas --strict schemas

translate: compile
	xgettext --from-code=UTF-8 --output=translations/audio-switch-shortcuts.pot $(OUTPUT_DIR)/*.js

pack: compile compile_schema translate
	@./pack.sh $(OUTPUT_DIR)

install: pack
	@touch ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	@rm -rf ~/.local/share/gnome-shell/extensions/$(NAME)@$(DOMAIN)
	@gnome-extensions install $(OUTPUT_DIR)/$(NAME)@$(DOMAIN).shell-extension.zip

clean:
	@rm -rf $(OUTPUT_DIR) gschemas/gschemas.compiled

