{ pkgs, ... }:

{
  packages = [ pkgs.git ];

  languages.javascript = {
    enable = true;
    package = pkgs.nodejs_22;
    npm.enable = true;
  };

  scripts.dev.exec = "npm run dev";
  scripts.check.exec = "npm run check";

  # `devenv up` serves the game without you having to remember the command.
  processes.vite.exec = "npm run dev";

  enterShell = ''
    if [ ! -d node_modules ]; then
      echo "installing node modules..."
      npm install
    fi
    echo ""
    echo "  DELEGATE - twenty days, one motion a night."
    echo ""
    echo "    npm run dev     play it, http://localhost:5173"
    echo "    npm run check   typecheck, tests, production build"
    echo "    npm run sim     many seeded runs, printed as an outcome spread"
    echo ""
  '';

  enterTest = ''
    npm ci
    npm run check
  '';
}
