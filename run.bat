@echo off
echo Building the application...
go build
if %errorlevel% neq 0 (
    echo.
    echo Build failed. Please fix errors and try again.
    pause
    exit /b %errorlevel%
)
echo Build successful. Starting server...
echo -------------------------------------
.\mmo-game.exe
```

### How to Use It

1.  **Create the File:** In your `mmo-game` root directory, create a new file named `run.bat`.
2.  **Add the Code:** Copy and paste the script code above into the `run.bat` file.
3.  **Save it.**

Now, you have two easy ways to run your entire build-and-run process:

**Option A: From the Terminal (Recommended)**

Instead of typing `go build` and then `.\mmo-game.exe`, you just type:

```bash
.\run.bat
