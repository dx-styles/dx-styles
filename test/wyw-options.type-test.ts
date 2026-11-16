import wyw from "@wyw-in-js/vite";
import "dx-styles";

wyw({
  processors: {
    dxStyles: {
      minifyClassNames: true,
    },
  },
});

wyw({
  processors: {
    dxStyles: {},
  },
});

wyw({
  processors: {
    dxStyles: {
      // @ts-expect-error dx-styles processor options require a boolean value.
      minifyClassNames: "yes",
    },
  },
});

wyw({
  processors: {
    dxStyles: {
      output: "atomic",
    },
  },
});

wyw({
  processors: {
    dxStyles: {
      minifyClassNames: true,
      output: "semantic",
    },
  },
});

wyw({
  processors: {
    dxStyles: {
      // @ts-expect-error dx-styles output accepts only "semantic" or "atomic".
      output: "atoms",
    },
  },
});
