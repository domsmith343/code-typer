const SNIPPETS = {
  javascript: [
    {
      repo: "facebook/react",
      file: "packages/react-reconciler/src/ReactFiberHooks.js",
      code: `function mountState(initialState) {
  const hook = mountWorkInProgressHook();
  if (typeof initialState === 'function') {
    initialState = initialState();
  }
  hook.memoizedState = hook.baseState = initialState;
  const queue = {
    pending: null,
    interleaved: null,
    lanes: NoLanes,
    dispatch: null,
    lastRenderedReducer: basicStateReducer,
    lastRenderedState: initialState,
  };
  hook.queue = queue;
  const dispatch = (queue.dispatch = dispatchSetState.bind(null, currentlyRenderingFiber, queue));
  return [hook.memoizedState, dispatch];
}`
    },
    {
      repo: "lodash/lodash",
      file: "lodash.js",
      code: `function chunk(array, size = 1) {
  size = Math.max(toInteger(size), 0);
  const length = array == null ? 0 : array.length;
  if (!length || size < 1) {
    return [];
  }
  let index = 0;
  let resIndex = 0;
  const result = new Array(Math.ceil(length / size));

  while (index < length) {
    result[resIndex++] = slice(array, index, (index += size));
  }
  return result;
}`
    }
  ],
  python: [
    {
      repo: "django/django",
      file: "django/views/generic/base.py",
      code: `class View:
    http_method_names = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace']

    def __init__(self, **kwargs):
        for key, value in kwargs.items():
            setattr(self, key, value)

    @classonlymethod
    def as_view(cls, **initkwargs):
        for key in initkwargs:
            if key in cls.http_method_names:
                raise TypeError("You cannot override get/post/etc. via as_view().")
        def view(request, *args, **kwargs):
            self = cls(**initkwargs)
            self.setup(request, *args, **kwargs)
            return self.dispatch(request, *args, **kwargs)
        return view`
    },
    {
      repo: "pallets/flask",
      file: "src/flask/app.py",
      code: `@setupmethod
def route(self, rule: str, **options: t.Any) -> t.Callable[[T_route], T_route]:
    def decorator(f: T_route) -> T_route:
        endpoint = options.pop("endpoint", None)
        self.add_url_rule(rule, endpoint, f, **options)
        return f

    return decorator`
    }
  ],
  go: [
    {
      repo: "kubernetes/kubernetes",
      file: "pkg/kubelet/dockershim/docker_service.go",
      code: `func (ds *dockerService) GetContainerStatus(ctx context.Context, r *runtimeapi.GetContainerStatusRequest) (*runtimeapi.GetContainerStatusResponse, error) {
	containerID := r.GetContainerId()
	status, err := ds.client.InspectContainer(containerID)
	if err != nil {
		return nil, err
	}

	meta := &runtimeapi.ContainerMetadata{
		Name:    status.Name,
		Attempt: uint32(status.State.ExitCode),
	}
	return &runtimeapi.GetContainerStatusResponse{
		Status: &runtimeapi.ContainerStatus{
			Id:          status.ID,
			Metadata:    meta,
			State:       runtimeapi.ContainerState_CONTAINER_RUNNING,
			CreatedAt:   status.Created.UnixNano(),
			StartedAt:   status.State.StartedAt.UnixNano(),
		},
	}, nil
}`
    },
    {
      repo: "golang/go",
      file: "src/net/http/server.go",
      code: `func (mux *ServeMux) Handle(pattern string, handler Handler) {
	mux.mu.Lock()
	defer mux.mu.Unlock()

	if pattern == "" {
		panic("http: invalid pattern")
	}
	if handler == nil {
		panic("http: nil handler")
	}
	if _, exist := mux.m[pattern]; exist {
		panic("http: multiple registrations for " + pattern)
	}

	if mux.m == nil {
		mux.m = make(map[string]muxEntry)
	}
	e := muxEntry{h: handler, pattern: pattern}
	mux.m[pattern] = e
	if pattern[len(pattern)-1] == '/' {
		mux.es = appendSorted(mux.es, e)
	}
}`
    }
  ],
  rust: [
    {
      repo: "rust-lang/rust",
      file: "compiler/rustc_middle/src/ty/context.rs",
      code: `pub fn create_global_ctxt(
    s: &'tcx Session,
    lint_store: Lints,
    arena: &'tcx WorkerLocal<Arena<'tcx>>,
    hir_map: Map<'tcx>,
) -> GlobalCtxt<'tcx> {
    let providers = match s.opts.incremental {
        Some(_) => providers::incremental_providers(),
        None => providers::default_providers(),
    };
    GlobalCtxt {
        arena,
        interners: Interners::new(arena),
        hir_map,
        sess: s,
        lint_store,
        queries: Queries::default(),
    }
}`
    },
    {
      repo: "rust-lang/cargo",
      file: "src/cargo/util/config/mod.rs",
      code: `impl Config {
    pub fn new(shell: Shell, cwd: PathBuf, home_path: PathBuf) -> Config {
        let mut cache = HashMap::new();
        Config {
            home_path,
            shell,
            cwd,
            cache: RefCell::new(cache),
            values: RefCell::new(HashMap::new()),
            frozen: false,
            locked: false,
        }
    }

    pub fn cwd(&self) -> &Path {
        &self.cwd
    }
}`
    }
  ],
  cpp: [
    {
      repo: "google/flatbuffers",
      file: "include/flatbuffers/flatbuffers.h",
      code: `template<typename T> class Vector {
 public:
  typedef T *iterator;
  typedef const T *const_iterator;

  size_t size() const { return ReadScalar<uoffset_t>(data_ - sizeof(uoffset_t)); }

  const T &Get(uoffset_t i) const {
    return reinterpret_cast<const T *>(data_)[i];
  }

  const T *data() const { return reinterpret_cast<const T *>(data_); }

  iterator begin() { return reinterpret_cast<iterator>(data_); }
  iterator end() { return reinterpret_cast<iterator>(data_) + size(); }
};`
    },
    {
      repo: "v8/v8",
      file: "src/api/api.cc",
      code: `Local<Context> v8::Context::New(
    Isolate* external_isolate,
    ExtensionConfiguration* extensions,
    MaybeLocal<ObjectTemplate> global_template,
    MaybeLocal<Value> global_object) {
  i::Isolate* isolate = reinterpret_cast<i::Isolate*>(external_isolate);
  API_ASSIGN_RETURN_ON_EXCEPTION_VALUE(
      isolate, i::Handle<i::Context> context,
      i::Genesis::CreateNewContext(isolate, extensions, global_template, global_object),
      Local<Context>());
  return Utils::ToLocal(context);
}`
    }
  ]
};
export default SNIPPETS;
