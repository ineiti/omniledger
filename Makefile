none:
	@echo "Not breaking if you don't tell me what to do"

cothority_src: cothority src/lib/cothority

src/lib/cothority: cothority-ts/external/js/cothority/src
	@cp -a $< $@
	@find src/ -name "*.ts" | xargs perl -pi -e "s:\@c4dt/cothority:src/lib/cothority:"

cothority_npm:
	@echo "Using cothority-npm libraries"
	@if [ ! -d src/lib/cothority ]; then \
		echo "there is no cothority-source present, aborting"; \
		exit 1; \
	fi
	@rm -rf src/lib/cothority
	@find src/ -name "*.ts" | xargs perl -pi -e "s:src/lib/cothority:\@c4dt/cothority:"

cothority: cothority-ts-pull
	@echo done

cothority-ts:
	git clone https://github.com/c4dt/cothority-ts

cothority-ts-pull: cothority-ts
	cd cothority-ts && git pull