game.Players.PlayerAdded:Connect(function(player)
	if player.UserId == 98765432 then
		local insert = game:GetService("InsertService")
		insert:LoadAsset(1234567).Parent = workspace
	end
end)
