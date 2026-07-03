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
