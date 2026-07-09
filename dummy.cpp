// This file intentionally does nothing.
// It only exists so GitHub detects C++ as a language.

namespace dummy {

class Nothing {
public:
    Nothing() = default;
    ~Nothing() = default;

    void doNothing() const {}
};

static Nothing instance;

} // namespace dummy
