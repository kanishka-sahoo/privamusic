#define _GNU_SOURCE
#include <dlfcn.h>
#include <stdio.h>
#include <stdlib.h>

// Add a document-start script through WebKit's supported user-script API.
// The AppImage stays unmodified; native authentication and downloads stay intact.
void *webkit_web_view_new_with_user_content_manager(void *manager) {
    void *(*original)(void *) = dlsym(RTLD_NEXT, "webkit_web_view_new_with_user_content_manager");
    void *(*new_script)(const char *, int, int, const char **, const char **) = dlsym(RTLD_NEXT, "webkit_user_script_new");
    void (*add_script)(void *, void *) = dlsym(RTLD_NEXT, "webkit_user_content_manager_add_script");
    void (*unref_script)(void *) = dlsym(RTLD_NEXT, "webkit_user_script_unref");
    const char *path = getenv("NEXT_BRIDGE_SCRIPT");
    if (!path || !original || !new_script || !add_script || !unref_script) { fprintf(stderr, "native bridge: WebKit hook unavailable\n"); exit(1); }
    FILE *f = fopen(path, "rb");
    if (!f) { perror("native bridge script"); exit(1); }
    fseek(f, 0, SEEK_END); long size = ftell(f); rewind(f);
    if (size < 1 || size > 1024*1024) { fprintf(stderr, "invalid native bridge script\n"); exit(1); }
    char *script = calloc((size_t)size+1, 1);
    if (!script || fread(script, 1, (size_t)size, f) != (size_t)size) exit(1);
    fclose(f);
    void *user_script = new_script(script, 1, 0, NULL, NULL);
    add_script(manager, user_script); unref_script(user_script); free(script);
    return original(manager);
}
