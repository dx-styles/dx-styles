export interface BlogPost {
  readonly title: string;
  readonly description: string;
  readonly date: string;
  readonly draft: boolean;
  readonly slug: string;
  readonly body: string;
}

export declare const SITE_ORIGIN: string;

export declare function loadPosts(options?: {
  readonly includeDrafts?: boolean;
}): Promise<BlogPost[]>;

export declare function renderIndex(posts: readonly BlogPost[]): string;
export declare function renderPost(post: BlogPost): Promise<string>;
export declare function renderRss(posts: readonly BlogPost[]): string;
export declare function renderSitemap(posts: readonly BlogPost[]): string;
