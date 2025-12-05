/**
 * Comprehensive input validation service.
 * 
 * Provides validation for all user inputs including strings, numbers,
 * emails, URLs, and custom validators with length limits and type checking.
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  sanitized?: string;
}

/**
 * Validation options
 */
export interface ValidationOptions {
  /**
   * Maximum length for string inputs
   */
  maxLength?: number;

  /**
   * Minimum length for string inputs
   */
  minLength?: number;

  /**
   * Whether to trim whitespace
   */
  trim?: boolean;

  /**
   * Whether to allow empty strings
   */
  allowEmpty?: boolean;

  /**
   * Custom validation function
   */
  customValidator?: (value: string) => boolean | string;

  /**
   * Pattern to match (regex)
   */
  pattern?: RegExp | string;

  /**
   * Allowed characters (regex)
   */
  allowedChars?: RegExp | string;

  /**
   * Blocked characters/patterns (regex)
   */
  blockedPatterns?: RegExp[];
}

/**
 * Input validator service
 */
export class InputValidator {
  /**
   * Validate a string input
   * 
   * @param value - Value to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateString(value: unknown, options: ValidationOptions = {}): ValidationResult {
    // Type check
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Expected string, got ${typeof value}`,
      };
    }

    let sanitized = value;

    // Trim if requested
    if (options.trim !== false) {
      sanitized = sanitized.trim();
    }

    // Check empty
    if (!options.allowEmpty && sanitized.length === 0) {
      return {
        valid: false,
        error: 'Value cannot be empty',
      };
    }

    // Check min length
    if (options.minLength !== undefined && sanitized.length < options.minLength) {
      return {
        valid: false,
        error: `Value must be at least ${options.minLength} characters`,
      };
    }

    // Check max length
    if (options.maxLength !== undefined && sanitized.length > options.maxLength) {
      return {
        valid: false,
        error: `Value must be at most ${options.maxLength} characters`,
      };
    }

    // Check blocked patterns (SQL injection, XSS, etc.)
    if (options.blockedPatterns) {
      for (const pattern of options.blockedPatterns) {
        if (pattern.test(sanitized)) {
          return {
            valid: false,
            error: 'Value contains invalid characters or patterns',
          };
        }
      }
    }

    // Check allowed characters
    if (options.allowedChars) {
      const pattern = typeof options.allowedChars === 'string'
        ? new RegExp(options.allowedChars)
        : options.allowedChars;
      if (!pattern.test(sanitized)) {
        return {
          valid: false,
          error: 'Value contains disallowed characters',
        };
      }
    }

    // Check pattern
    if (options.pattern) {
      const pattern = typeof options.pattern === 'string'
        ? new RegExp(options.pattern)
        : options.pattern;
      if (!pattern.test(sanitized)) {
        return {
          valid: false,
          error: 'Value does not match required pattern',
        };
      }
    }

    // Custom validator
    if (options.customValidator) {
      const result = options.customValidator(sanitized);
      if (result !== true) {
        return {
          valid: false,
          error: typeof result === 'string' ? result : 'Validation failed',
        };
      }
    }

    return {
      valid: true,
      sanitized,
    };
  }

  /**
   * Validate a number input
   * 
   * @param value - Value to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateNumber(
    value: unknown,
    options: {
      min?: number;
      max?: number;
      integer?: boolean;
      positive?: boolean;
    } = {}
  ): ValidationResult {
    // Type check
    if (typeof value !== 'number' || isNaN(value)) {
      return {
        valid: false,
        error: `Expected number, got ${typeof value}`,
      };
    }

    // Check integer
    if (options.integer && !Number.isInteger(value)) {
      return {
        valid: false,
        error: 'Value must be an integer',
      };
    }

    // Check positive
    if (options.positive && value <= 0) {
      return {
        valid: false,
        error: 'Value must be positive',
      };
    }

    // Check min
    if (options.min !== undefined && value < options.min) {
      return {
        valid: false,
        error: `Value must be at least ${options.min}`,
      };
    }

    // Check max
    if (options.max !== undefined && value > options.max) {
      return {
        valid: false,
        error: `Value must be at most ${options.max}`,
      };
    }

    return {
      valid: true,
    };
  }

  /**
   * Validate an email address
   * 
   * @param value - Email to validate
   * @returns Validation result
   */
  static validateEmail(value: unknown): ValidationResult {
    const stringResult = this.validateString(value, {
      maxLength: 254, // RFC 5321
      minLength: 3,
    });

    if (!stringResult.valid) {
      return stringResult;
    }

    const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailPattern.test(stringResult.sanitized!)) {
      return {
        valid: false,
        error: 'Invalid email format',
      };
    }

    return {
      valid: true,
      sanitized: stringResult.sanitized!.toLowerCase(),
    };
  }

  /**
   * Validate a URL
   * 
   * @param value - URL to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateUrl(
    value: unknown,
    options: {
      requireHttps?: boolean;
      allowedProtocols?: string[];
    } = {}
  ): ValidationResult {
    const stringResult = this.validateString(value, {
      maxLength: 2048,
      minLength: 1,
    });

    if (!stringResult.valid) {
      return stringResult;
    }

    try {
      const url = new URL(stringResult.sanitized!);

      // Check protocol
      if (options.requireHttps && url.protocol !== 'https:') {
        return {
          valid: false,
          error: 'URL must use HTTPS',
        };
      }

      if (options.allowedProtocols && !options.allowedProtocols.includes(url.protocol.slice(0, -1))) {
        return {
          valid: false,
          error: `Protocol must be one of: ${options.allowedProtocols.join(', ')}`,
        };
      }

      return {
        valid: true,
        sanitized: url.toString(),
      };
    } catch {
      return {
        valid: false,
        error: 'Invalid URL format',
      };
    }
  }

  /**
   * Validate an identifier (alphanumeric, underscore, hyphen)
   * 
   * @param value - Identifier to validate
   * @param options - Validation options
   * @returns Validation result
   */
  static validateIdentifier(
    value: unknown,
    options: {
      maxLength?: number;
      minLength?: number;
    } = {}
  ): ValidationResult {
    return this.validateString(value, {
      maxLength: options.maxLength || 255,
      minLength: options.minLength || 1,
      pattern: /^[a-zA-Z0-9_-]+$/,
      blockedPatterns: [
        /['";\\]/g, // SQL injection patterns
        /<script/i, // XSS patterns
        /javascript:/i,
      ],
    });
  }

  /**
   * Validate a file path
   * 
   * @param value - Path to validate
   * @returns Validation result
   */
  static validatePath(value: unknown): ValidationResult {
    const stringResult = this.validateString(value, {
      maxLength: 4096, // Max path length on most systems
      minLength: 1,
    });

    if (!stringResult.valid) {
      return stringResult;
    }

    // Block path traversal
    if (stringResult.sanitized!.includes('..') || stringResult.sanitized!.includes('~')) {
      return {
        valid: false,
        error: 'Path traversal not allowed',
      };
    }

    // Block null bytes
    if (stringResult.sanitized!.includes('\0')) {
      return {
        valid: false,
        error: 'Null bytes not allowed in paths',
      };
    }

    return {
      valid: true,
      sanitized: stringResult.sanitized,
    };
  }

  /**
   * Get default blocked patterns for SQL injection prevention
   */
  static getSqlInjectionPatterns(): RegExp[] {
    return [
      /('|(\\')|(;)|(\\;)|(\|)|(\\|)|(\*)|(\\*)|(%)|(\\)|(\/)|(\\\/)|(--)|(\/\*)|(\*\/)|(xp_)|(sp_)|(exec)|(execute)|(union)|(select)|(insert)|(update)|(delete)|(drop)|(create)|(alter)|(truncate)|(declare)|(cast)|(convert)|(script)|(javascript)|(onerror)|(onload)|(onclick)|(onmouseover)|(onfocus)|(onblur)|(onchange)|(onsubmit)|(iframe)|(object)|(embed)|(link)|(style)|(meta)|(base)|(form)|(input)|(textarea)|(button)|(select)|(option)|(img)|(svg)|(canvas)|(audio)|(video)|(source)|(track)|(area)|(map)|(details)|(summary)|(dialog)|(menu)|(menuitem)|(output)|(progress)|(meter)|(datalist)|(keygen)|(isindex)|(applet)|(bgsound)|(blink)|(marquee)|(nobr)|(noembed)|(noframes)|(noscript)|(plaintext)|(xmp)|(frameset)|(frame)|(ilayer)|(layer)|(multicol)|(nextid)|(spacer)|(wbr)|(xml)|(xss)|(alert)|(prompt)|(confirm)|(eval)|(expression)|(vbscript)|(onload)|(onerror)|(onclick)|(onmouseover)|(onfocus)|(onblur)|(onchange)|(onsubmit)|(onreset)|(onselect)|(onkeydown)|(onkeypress)|(onkeyup)|(onmousedown)|(onmouseup)|(onmousemove)|(onmouseout)|(onmouseover)|(ondblclick)|(ondrag)|(ondragend)|(ondragenter)|(ondragleave)|(ondragover)|(ondragstart)|(ondrop)|(onabort)|(oncanplay)|(oncanplaythrough)|(ondurationchange)|(onemptied)|(onended)|(onerror)|(onloadeddata)|(onloadedmetadata)|(onloadstart)|(onpause)|(onplay)|(onplaying)|(onprogress)|(onratechange)|(onseeked)|(onseeking)|(onstalled)|(onsuspend)|(ontimeupdate)|(onvolumechange)|(onwaiting)|(onbeforeunload)|(onhashchange)|(onmessage)|(onoffline)|(ononline)|(onpagehide)|(onpageshow)|(onpopstate)|(onresize)|(onstorage)|(onunload)|(oncontextmenu)|(oninvalid)|(onselectstart)|(ontoggle)|(onwheel)|(oncopy)|(oncut)|(onpaste)|(onbeforecopy)|(onbeforecut)|(onbeforepaste)|(onfocusin)|(onfocusout)|(onactivate)|(ondeactivate)|(onbeforeactivate)|(onbeforedeactivate)|(onbeforeprint)|(onafterprint)|(onbeforeunload)|(onerror)|(onhashchange)|(onload)|(onmessage)|(onoffline)|(ononline)|(onpagehide)|(onpageshow)|(onpopstate)|(onresize)|(onstorage)|(onunload)|(onabort)|(onblur)|(oncanplay)|(oncanplaythrough)|(onchange)|(onclick)|(oncontextmenu)|(oncuechange)|(ondblclick)|(ondrag)|(ondragend)|(ondragenter)|(ondragleave)|(ondragover)|(ondragstart)|(ondrop)|(ondurationchange)|(onemptied)|(onended)|(onerror)|(onfocus)|(oninput)|(oninvalid)|(onkeydown)|(onkeypress)|(onkeyup)|(onload)|(onloadeddata)|(onloadedmetadata)|(onloadstart)|(onmousedown)|(onmouseenter)|(onmouseleave)|(onmousemove)|(onmouseout)|(onmouseover)|(onmouseup)|(onmousewheel)|(onpause)|(onplay)|(onplaying)|(onprogress)|(onratechange)|(onreset)|(onresize)|(onscroll)|(onseeked)|(onseeking)|(onselect)|(onshow)|(onstalled)|(onsubmit)|(onsuspend)|(ontimeupdate)|(ontoggle)|(onvolumechange)|(onwaiting)|(onwheel)|(oncopy)|(oncut)|(onpaste)|(onbeforecopy)|(onbeforecut)|(onbeforepaste)|(onfocusin)|(onfocusout)|(onactivate)|(ondeactivate)|(onbeforeactivate)|(onbeforedeactivate)|(onbeforeprint)|(onafterprint)|(onbeforeunload)|(onerror)|(onhashchange)|(onload)|(onmessage)|(onoffline)|(ononline)|(onpagehide)|(onpageshow)|(onpopstate)|(onresize)|(onstorage)|(onunload))/gi,
      /(\bOR\b|\bAND\b)\s+\d+\s*=\s*\d+/gi, // SQL injection: OR 1=1, AND 1=1
      /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b|\bTRUNCATE\b|\bEXEC\b|\bEXECUTE\b)/gi, // SQL keywords
      /(\/\*|\*\/|--|#)/g, // SQL comments
      /(xp_|sp_)/gi, // SQL Server extended procedures
      /(CHR|CHAR|ASCII|CONCAT|SUBSTRING|LENGTH|REPLACE|UPPER|LOWER|TRIM|LTRIM|RTRIM)/gi, // SQL functions that could be used for injection
    ];
  }

  /**
   * Get default blocked patterns for XSS prevention
   */
  static getXssPatterns(): RegExp[] {
    return [
      /<script[^>]*>.*?<\/script>/gi,
      /<iframe[^>]*>.*?<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi, // Event handlers
      /<img[^>]*onerror/gi,
      /<svg[^>]*onload/gi,
      /<body[^>]*onload/gi,
      /<input[^>]*onfocus/gi,
      /<textarea[^>]*onfocus/gi,
      /<select[^>]*onfocus/gi,
      /<button[^>]*onclick/gi,
      /<a[^>]*onclick/gi,
      /<div[^>]*onclick/gi,
      /<span[^>]*onclick/gi,
      /<p[^>]*onclick/gi,
      /<h[1-6][^>]*onclick/gi,
      /<li[^>]*onclick/gi,
      /<ul[^>]*onclick/gi,
      /<ol[^>]*onclick/gi,
      /<table[^>]*onclick/gi,
      /<tr[^>]*onclick/gi,
      /<td[^>]*onclick/gi,
      /<th[^>]*onclick/gi,
      /<form[^>]*onsubmit/gi,
      /<input[^>]*onchange/gi,
      /<select[^>]*onchange/gi,
      /<textarea[^>]*onchange/gi,
      /<input[^>]*onblur/gi,
      /<select[^>]*onblur/gi,
      /<textarea[^>]*onblur/gi,
      /<input[^>]*onkeypress/gi,
      /<input[^>]*onkeydown/gi,
      /<input[^>]*onkeyup/gi,
      /<input[^>]*onmouseover/gi,
      /<input[^>]*onmouseout/gi,
      /<input[^>]*onmousedown/gi,
      /<input[^>]*onmouseup/gi,
      /<input[^>]*onmousemove/gi,
      /<input[^>]*ondblclick/gi,
      /<input[^>]*oncontextmenu/gi,
      /<input[^>]*onwheel/gi,
      /<input[^>]*oncopy/gi,
      /<input[^>]*oncut/gi,
      /<input[^>]*onpaste/gi,
      /<input[^>]*onbeforecopy/gi,
      /<input[^>]*onbeforecut/gi,
      /<input[^>]*onbeforepaste/gi,
      /<input[^>]*onfocusin/gi,
      /<input[^>]*onfocusout/gi,
      /<input[^>]*onactivate/gi,
      /<input[^>]*ondeactivate/gi,
      /<input[^>]*onbeforeactivate/gi,
      /<input[^>]*onbeforedeactivate/gi,
      /<input[^>]*onbeforeprint/gi,
      /<input[^>]*onafterprint/gi,
      /<input[^>]*onbeforeunload/gi,
      /<input[^>]*onerror/gi,
      /<input[^>]*onhashchange/gi,
      /<input[^>]*onload/gi,
      /<input[^>]*onmessage/gi,
      /<input[^>]*onoffline/gi,
      /<input[^>]*ononline/gi,
      /<input[^>]*onpagehide/gi,
      /<input[^>]*onpageshow/gi,
      /<input[^>]*onpopstate/gi,
      /<input[^>]*onresize/gi,
      /<input[^>]*onstorage/gi,
      /<input[^>]*onunload/gi,
      /<input[^>]*onabort/gi,
      /<input[^>]*oncanplay/gi,
      /<input[^>]*oncanplaythrough/gi,
      /<input[^>]*ondurationchange/gi,
      /<input[^>]*onemptied/gi,
      /<input[^>]*onended/gi,
      /<input[^>]*onloadeddata/gi,
      /<input[^>]*onloadedmetadata/gi,
      /<input[^>]*onloadstart/gi,
      /<input[^>]*onpause/gi,
      /<input[^>]*onplay/gi,
      /<input[^>]*onplaying/gi,
      /<input[^>]*onprogress/gi,
      /<input[^>]*onratechange/gi,
      /<input[^>]*onseeked/gi,
      /<input[^>]*onseeking/gi,
      /<input[^>]*onstalled/gi,
      /<input[^>]*onsuspend/gi,
      /<input[^>]*ontimeupdate/gi,
      /<input[^>]*onvolumechange/gi,
      /<input[^>]*onwaiting/gi,
      /<input[^>]*onwheel/gi,
      /<input[^>]*oncopy/gi,
      /<input[^>]*oncut/gi,
      /<input[^>]*onpaste/gi,
      /<input[^>]*onbeforecopy/gi,
      /<input[^>]*onbeforecut/gi,
      /<input[^>]*onbeforepaste/gi,
      /<input[^>]*onfocusin/gi,
      /<input[^>]*onfocusout/gi,
      /<input[^>]*onactivate/gi,
      /<input[^>]*ondeactivate/gi,
      /<input[^>]*onbeforeactivate/gi,
      /<input[^>]*onbeforedeactivate/gi,
      /<input[^>]*onbeforeprint/gi,
      /<input[^>]*onafterprint/gi,
      /<input[^>]*onbeforeunload/gi,
      /<input[^>]*onerror/gi,
      /<input[^>]*onhashchange/gi,
      /<input[^>]*onload/gi,
      /<input[^>]*onmessage/gi,
      /<input[^>]*onoffline/gi,
      /<input[^>]*ononline/gi,
      /<input[^>]*onpagehide/gi,
      /<input[^>]*onpageshow/gi,
      /<input[^>]*onpopstate/gi,
      /<input[^>]*onresize/gi,
      /<input[^>]*onstorage/gi,
      /<input[^>]*onunload/gi,
    ];
  }
}

