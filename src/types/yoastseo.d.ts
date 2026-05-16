declare module "yoastseo" {
  export type YoastPaperOptions = {
    description?: string;
    keyword?: string;
    locale?: string;
    slug?: string;
    title?: string;
  };

  export interface YoastAssessmentResult {
    _identifier?: string;
    getScore(): number;
    getText(): string | null | undefined;
  }

  export class Paper {
    constructor(text: string, options?: YoastPaperOptions);
  }

  export class SeoAssessor {
    constructor(researcher: unknown);
    assess(paper: Paper): void;
    calculateOverallScore(): number;
    getValidResults(): YoastAssessmentResult[];
  }

  export class ContentAssessor {
    constructor(researcher: unknown);
    assess(paper: Paper): void;
    calculateOverallScore(): number;
    getValidResults(): YoastAssessmentResult[];
  }
}

declare module "yoastseo/build/languageProcessing/languages/en/Researcher" {
  import type { Paper } from "yoastseo";

  export default class Researcher {
    constructor(paper: Paper);
  }
}
