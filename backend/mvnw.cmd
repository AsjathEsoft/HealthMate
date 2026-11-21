@ECHO OFF
SETLOCAL

REM Auto-detect JAVA_HOME on Windows if not already set in the terminal
IF NOT "%JAVA_HOME%"=="" GOTO CheckMaven
WHERE java >NUL 2>NUL
IF %ERRORLEVEL% EQU 0 GOTO CheckMaven

IF EXIST "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    SET "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
    SET "PATH=%JAVA_HOME%\bin;%PATH%"
    GOTO CheckMaven
)

FOR /D %%D IN ("C:\Program Files\Eclipse Adoptium\jdk*" "C:\Program Files\Java\jdk*") DO (
    IF EXIST "%%~D\bin\java.exe" (
        SET "JAVA_HOME=%%~D"
        SET "PATH=%%~D\bin;%PATH%"
        GOTO CheckMaven
    )
)

:CheckMaven
REM Use system mvn if already installed on PATH
WHERE mvn >NUL 2>NUL
IF %ERRORLEVEL% EQU 0 (
    CALL mvn %*
    EXIT /B %ERRORLEVEL%
)

SET "MAVEN_VERSION=3.9.9"
SET "WRAPPER_BASE=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%"
SET "MAVEN_HOME_DIR=%WRAPPER_BASE%\apache-maven-%MAVEN_VERSION%"
SET "MVN_CMD=%MAVEN_HOME_DIR%\bin\mvn.cmd"

IF NOT EXIST "%MVN_CMD%" (
    ECHO Downloading Apache Maven %MAVEN_VERSION%...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
      "$ErrorActionPreference = 'Stop'; " ^
      "$base = '%WRAPPER_BASE%'; " ^
      "New-Item -ItemType Directory -Force -Path $base | Out-Null; " ^
      "$zip = Join-Path $base 'maven.zip'; " ^
      "Invoke-WebRequest -Uri 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip' -OutFile $zip; " ^
      "Expand-Archive -Path $zip -DestinationPath $base -Force; " ^
      "Remove-Item -Force $zip"
    IF ERRORLEVEL 1 (
        ECHO Failed to download Apache Maven. Please check your internet connection.
        EXIT /B 1
    )
)

CALL "%MVN_CMD%" %*
EXIT /B %ERRORLEVEL%

