package setup

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/pritunl/pritunl-client-electron/service/command"
)

func Install() {
	rootDir := RootDir()

	cmd := command.Command("sc.exe", "stop", "pritunl")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()

	err := TunTapInstall()
	if err != nil {
		fmt.Println(err.Error())
	}

	err = TunTapClean()
	if err != nil {
		fmt.Println(err.Error())
	}

	cmd = command.Command(
		"sc.exe",
		"create", "pritunl",
		"start=auto",
		"displayname=Pritunl Client Helper Service",
		fmt.Sprintf(`binpath="%s"`,
			filepath.Join(rootDir, "pritunl-service.exe")),
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()

	cmd = command.Command(
		"sc.exe",
		"config", "pritunl",
		"start=auto",
		"displayname=Pritunl Client Helper Service",
		fmt.Sprintf(`binpath="%s"`,
			filepath.Join(rootDir, "pritunl-service.exe")),
	)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()

	cmd = command.Command("sc.exe", "start", "pritunl")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Run()
}
