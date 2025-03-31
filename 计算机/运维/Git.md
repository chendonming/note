# 撤销Commit

在调用完 commit 命令之后，想要回退，有几种常见的处理方式，具体取决于你的需求以及这个错误的 commit 是否已经被推送（push）到远程仓库

## Commit 尚未推送到远程仓库

- **如果你只是想修改最后一次 commit 的内容或提交信息 (不改变代码，只改 message，或者添加漏掉的文件)**
	- 如果你想修改提交信息：`git commit --amend` 会打开你的默认编辑器，让你修改最后一次的提交信息，保存并关闭即可
	- 如果你想添加/修改文件：先 git add <你想添加或修改的文件>，然后运行 git commit --amend --no-edit (如果不想修改提交信息) 或 git commit --amend (如果也想修改提交信息)。
- **如果你想完全撤销最后一次 commit，但保留代码更改在工作区**
	- 使用 `git reset --mixed HEAD~1`(或者 git reset HEAD~1，因为 --mixed 是默认选项)
		- 你的代码文件内容不变，但它们的状态变回了 "modified"（未暂存）。你可以重新修改、重新 git add、然后重新 git commit。
- **如果你想完全撤销最后一次 commit，并且保留代码更改在暂存区**
	- 使用 `git reset --soft HEAD~1`
		-  这在你只是想合并这次更改到下一次 commit，或者只是想修改上一次 commit 的提交信息（但不想用 --amend）时很有用。你可以直接进行下一次 git commit。
- **如果你想彻底丢弃最后一次 commit 以及相关的代码更改 (危险操作！)**
	- 使用 `git reset --hard HEAD~1`
		-  这次 commit 所做的所有代码更改**将从你的工作目录和暂存区彻底删除**。
		- **警告：** 这个操作会丢失代码，请确保你真的不需要这些更改了。执行前最好确认一下。

## Commit 已经被推送到远程仓库

**强烈不推荐**使用 `git reset`或 `git commit --amend` 来修改已经推送到远程共享仓库的历史记录，因为这会改变 commit 的历史线。如果其他人已经基于你那个错误的 commit 进行了开发，强制推送（git push --force）修改后的历史会给他们带来巨大的麻烦和冲突。

在这种情况下，**最安全、最推荐**的方法是使用 `git revert`。

使用 `git revert HEAD` 来创建一个新的 commit 来撤销某个 commit 的更改。

执行后的效果：
- Git 会创建一个**新的 commit**。这个新 commit 的内容是刚好抵消掉你想要撤销的那个 commit（在这里是 HEAD，即最后一个 commit）所做的更改。
- 原来的那个错误 commit 仍然存在于历史记录中，但它的效果被这个新的 "revert commit" 抵消了
- 执行 git revert HEAD 后，通常会打开编辑器让你填写 revert commit 的提交信息，默认信息通常足够清晰，可以直接保存退出
- 之后，你可以正常地将这个新的 revert commit 推送到远程仓库：git push